#include <windows.h>
#include <wininet.h>
#include <shlobj.h>
#include <commctrl.h>
#include <string>
#include <fstream>

#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "uuid.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "comctl32.lib")

// ============================================
// НАСТРОЙКИ - ИЗМЕНИ URL НА СВОЙ
// ============================================
// Для localhost:
const char* DOWNLOAD_URL = "http://localhost:3000/download/TuClient.zip";

// Для продакшена (когда задеплоишь):
// const char* DOWNLOAD_URL = "https://tublox.onrender.com/download/TuClient.zip";

const char* INSTALL_FOLDER = "TuBlox";
const char* CLIENT_EXE = "TuClient.exe";
const char* ZIP_FOLDER_INSIDE = "TuClient";

// ============================================
// UI Elements
// ============================================
HWND hProgressBar = NULL;
HWND hStatusText = NULL;
HWND hMainWindow = NULL;
HWND hInstallBtn = NULL;

void UpdateProgress(int percent, const char* status) {
    if (hProgressBar) {
        SendMessage(hProgressBar, PBM_SETPOS, percent, 0);
    }
    if (hStatusText) {
        SetWindowTextA(hStatusText, status);
    }
    
    MSG msg;
    while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
}

// ============================================
// Пути
// ============================================
std::string GetInstallPath() {
    char localAppData[MAX_PATH];
    if (SHGetFolderPathA(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, localAppData) == S_OK) {
        return std::string(localAppData) + "\\" + INSTALL_FOLDER;
    }
    return "C:\\TuBlox";
}

std::string GetTempFilePath() {
    char tempPath[MAX_PATH];
    GetTempPathA(MAX_PATH, tempPath);
    return std::string(tempPath) + "TuClient.zip";
}

// ============================================
// Скачивание файла
// ============================================
bool DownloadFile(const std::string& url, const std::string& savePath) {
    UpdateProgress(5, "Connecting to server...");
    
    // Определяем HTTPS или HTTP
    bool isHttps = (url.find("https://") == 0);
    
    HINTERNET hInternet = InternetOpenA(
        "TuBlox Installer/1.0",
        INTERNET_OPEN_TYPE_PRECONFIG,
        NULL, NULL, 0
    );
    
    if (!hInternet) {
        UpdateProgress(0, "Error: Cannot initialize internet");
        return false;
    }
    
    // Таймауты
    DWORD timeout = 30000; // 30 секунд
    InternetSetOptionA(hInternet, INTERNET_OPTION_CONNECT_TIMEOUT, &timeout, sizeof(timeout));
    InternetSetOptionA(hInternet, INTERNET_OPTION_RECEIVE_TIMEOUT, &timeout, sizeof(timeout));
    InternetSetOptionA(hInternet, INTERNET_OPTION_SEND_TIMEOUT, &timeout, sizeof(timeout));
    
    UpdateProgress(8, "Downloading TuClient.zip...");
    
    // Флаги для HTTP и HTTPS
    DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE;
    if (isHttps) {
        flags |= INTERNET_FLAG_SECURE;
        flags |= INTERNET_FLAG_IGNORE_CERT_CN_INVALID;
        flags |= INTERNET_FLAG_IGNORE_CERT_DATE_INVALID;
    }
    
    HINTERNET hUrl = InternetOpenUrlA(
        hInternet,
        url.c_str(),
        NULL, 0,
        flags,
        0
    );
    
    if (!hUrl) {
        DWORD err = GetLastError();
        char msg[256];
        sprintf(msg, "Error: Cannot connect (code %lu)", err);
        UpdateProgress(0, msg);
        InternetCloseHandle(hInternet);
        return false;
    }
    
    UpdateProgress(10, "Connected! Downloading...");
    
    // HTTP статус
    DWORD statusCode = 0;
    DWORD size = sizeof(statusCode);
    HttpQueryInfoA(hUrl, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER, &statusCode, &size, NULL);
    
    if (statusCode >= 400) {
        char msg[128];
        sprintf(msg, "Error: HTTP %lu", statusCode);
        UpdateProgress(0, msg);
        InternetCloseHandle(hUrl);
        InternetCloseHandle(hInternet);
        return false;
    }
    
    // Размер файла
    char sizeBuffer[32] = {0};
    DWORD sizeBufferLen = sizeof(sizeBuffer);
    DWORD idx = 0;
    DWORD totalSize = 0;
    
    if (HttpQueryInfoA(hUrl, HTTP_QUERY_CONTENT_LENGTH, sizeBuffer, &sizeBufferLen, &idx)) {
        totalSize = atoi(sizeBuffer);
    }
    
    // Создаём файл
    std::ofstream file(savePath, std::ios::binary);
    if (!file.is_open()) {
        UpdateProgress(0, "Error: Cannot create temp file");
        InternetCloseHandle(hUrl);
        InternetCloseHandle(hInternet);
        return false;
    }
    
    // Скачиваем
    char buffer[8192];
    DWORD bytesRead;
    DWORD totalRead = 0;
    int lastPercent = 0;
    
    while (true) {
        if (!InternetReadFile(hUrl, buffer, sizeof(buffer), &bytesRead)) {
            DWORD err = GetLastError();
            char msg[128];
            sprintf(msg, "Error: Read failed (code %lu)", err);
            UpdateProgress(0, msg);
            file.close();
            InternetCloseHandle(hUrl);
            InternetCloseHandle(hInternet);
            DeleteFileA(savePath.c_str());
            return false;
        }
        
        if (bytesRead == 0) break;
        
        file.write(buffer, bytesRead);
        totalRead += bytesRead;
        
        int percent = 10;
        if (totalSize > 0) {
            percent = 10 + (int)((totalRead * 50) / totalSize);
        }
        
        if (percent != lastPercent) {
            lastPercent = percent;
            char status[128];
            
            if (totalSize > 0) {
                sprintf(status, "Downloading... %.1f / %.1f MB", 
                        totalRead / 1048576.0f, totalSize / 1048576.0f);
            } else {
                sprintf(status, "Downloading... %.1f MB", totalRead / 1048576.0f);
            }
            
            UpdateProgress(percent, status);
        }
    }
    
    file.close();
    InternetCloseHandle(hUrl);
    InternetCloseHandle(hInternet);
    
    if (totalRead < 1000) {
        UpdateProgress(0, "Error: File too small");
        DeleteFileA(savePath.c_str());
        return false;
    }
    
    char finalStatus[128];
    sprintf(finalStatus, "Downloaded %.1f MB", totalRead / 1048576.0f);
    UpdateProgress(60, finalStatus);
    
    return true;
}

// ============================================
// Распаковка ZIP
// ============================================
bool ExtractZip(const std::string& zipPath, const std::string& destPath) {
    UpdateProgress(62, "Extracting files...");
    
    CreateDirectoryA(destPath.c_str(), NULL);
    
    std::string cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"";
    cmd += "Expand-Archive -LiteralPath '";
    cmd += zipPath;
    cmd += "' -DestinationPath '";
    cmd += destPath;
    cmd += "' -Force\"";
    
    STARTUPINFOA si = {0};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    
    PROCESS_INFORMATION pi = {0};
    
    if (!CreateProcessA(NULL, (LPSTR)cmd.c_str(), NULL, NULL, FALSE,
                        CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        UpdateProgress(0, "Error: Cannot run PowerShell");
        return false;
    }
    
    int dots = 0;
    while (WaitForSingleObject(pi.hProcess, 500) == WAIT_TIMEOUT) {
        dots = (dots + 1) % 4;
        char status[64];
        sprintf(status, "Extracting%.*s", dots + 1, "....");
        UpdateProgress(65 + dots * 3, status);
    }
    
    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    
    if (exitCode != 0) {
        UpdateProgress(0, "Error: Extraction failed");
        return false;
    }
    
    UpdateProgress(80, "Files extracted!");
    return true;
}

// ============================================
// Поиск exe
// ============================================
std::string FindClientExe(const std::string& installPath) {
    // Вариант 1: TuClient/TuClient.exe
    std::string path1 = installPath + "\\" + ZIP_FOLDER_INSIDE + "\\" + CLIENT_EXE;
    if (GetFileAttributesA(path1.c_str()) != INVALID_FILE_ATTRIBUTES) {
        return path1;
    }
    
    // Вариант 2: TuClient.exe в корне
    std::string path2 = installPath + "\\" + CLIENT_EXE;
    if (GetFileAttributesA(path2.c_str()) != INVALID_FILE_ATTRIBUTES) {
        return path2;
    }
    
    // Вариант 3: Поиск в подпапках
    WIN32_FIND_DATAA fd;
    HANDLE hFind = FindFirstFileA((installPath + "\\*").c_str(), &fd);
    
    if (hFind != INVALID_HANDLE_VALUE) {
        do {
            if ((fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) &&
                strcmp(fd.cFileName, ".") != 0 && 
                strcmp(fd.cFileName, "..") != 0) {
                
                std::string subPath = installPath + "\\" + fd.cFileName + "\\" + CLIENT_EXE;
                if (GetFileAttributesA(subPath.c_str()) != INVALID_FILE_ATTRIBUTES) {
                    FindClose(hFind);
                    return subPath;
                }
            }
        } while (FindNextFileA(hFind, &fd));
        FindClose(hFind);
    }
    
    return "";
}

// ============================================
// Регистрация протокола
// ============================================
bool RegisterProtocol(const std::string& exePath) {
    UpdateProgress(85, "Registering tublox:// protocol...");
    
    HKEY hKey;
    
    if (RegCreateKeyExA(HKEY_CURRENT_USER, "Software\\Classes\\tublox", 
        0, NULL, REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL) != ERROR_SUCCESS) {
        return false;
    }
    
    const char* desc = "URL:TuBlox Protocol";
    RegSetValueExA(hKey, NULL, 0, REG_SZ, (BYTE*)desc, (DWORD)strlen(desc) + 1);
    RegSetValueExA(hKey, "URL Protocol", 0, REG_SZ, (BYTE*)"", 1);
    RegCloseKey(hKey);
    
    std::string iconPath = "\"" + exePath + "\",0";
    RegCreateKeyExA(HKEY_CURRENT_USER, "Software\\Classes\\tublox\\DefaultIcon",
        0, NULL, REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL);
    RegSetValueExA(hKey, NULL, 0, REG_SZ, (BYTE*)iconPath.c_str(), (DWORD)iconPath.size() + 1);
    RegCloseKey(hKey);
    
    RegCreateKeyExA(HKEY_CURRENT_USER, "Software\\Classes\\tublox\\shell\\open\\command",
        0, NULL, REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL);
    std::string command = "\"" + exePath + "\" \"%1\"";
    RegSetValueExA(hKey, NULL, 0, REG_SZ, (BYTE*)command.c_str(), (DWORD)command.size() + 1);
    RegCloseKey(hKey);
    
    UpdateProgress(90, "Protocol registered!");
    return true;
}

// ============================================
// Ярлык на рабочий стол
// ============================================
bool CreateDesktopShortcut(const std::string& exePath) {
    UpdateProgress(93, "Creating shortcut...");
    
    CoInitialize(NULL);
    
    IShellLinkA* pLink = NULL;
    if (SUCCEEDED(CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER,
                                    IID_IShellLinkA, (void**)&pLink))) {
        pLink->SetPath(exePath.c_str());
        pLink->SetDescription("TuBlox Client");
        
        size_t pos = exePath.find_last_of("\\/");
        if (pos != std::string::npos) {
            pLink->SetWorkingDirectory(exePath.substr(0, pos).c_str());
        }
        
        char desktop[MAX_PATH];
        SHGetFolderPathA(NULL, CSIDL_DESKTOPDIRECTORY, NULL, 0, desktop);
        
        IPersistFile* pFile = NULL;
        if (SUCCEEDED(pLink->QueryInterface(IID_IPersistFile, (void**)&pFile))) {
            WCHAR wsz[MAX_PATH];
            MultiByteToWideChar(CP_ACP, 0, (std::string(desktop) + "\\TuBlox.lnk").c_str(), -1, wsz, MAX_PATH);
            pFile->Save(wsz, TRUE);
            pFile->Release();
        }
        pLink->Release();
    }
    
    CoUninitialize();
    UpdateProgress(96, "Shortcut created!");
    return true;
}

// ============================================
// Установка
// ============================================
bool DoInstall() {
    std::string installPath = GetInstallPath();
    std::string zipPath = GetTempFilePath();
    
    UpdateProgress(0, "Starting installation...");
    
    if (!DownloadFile(DOWNLOAD_URL, zipPath)) {
        return false;
    }
    
    if (!ExtractZip(zipPath, installPath)) {
        DeleteFileA(zipPath.c_str());
        return false;
    }
    
    DeleteFileA(zipPath.c_str());
    UpdateProgress(82, "Looking for TuClient.exe...");
    
    std::string clientExe = FindClientExe(installPath);
    
    if (clientExe.empty()) {
        UpdateProgress(0, "Error: TuClient.exe not found!");
        return false;
    }
    
    if (!RegisterProtocol(clientExe)) {
        UpdateProgress(0, "Error: Failed to register protocol");
        return false;
    }
    
    CreateDesktopShortcut(clientExe);
    
    UpdateProgress(100, "Installation complete!");
    return true;
}

// ============================================
// Window Procedure
// ============================================
LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            HFONT hFont = CreateFontA(15, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, "Segoe UI");
            
            HFONT hFontBold = CreateFontA(22, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, "Segoe UI");
            
            HWND hTitle = CreateWindowA("STATIC", "TuBlox Installer",
                WS_CHILD | WS_VISIBLE | SS_CENTER,
                20, 15, 360, 30, hwnd, NULL, NULL, NULL);
            SendMessage(hTitle, WM_SETFONT, (WPARAM)hFontBold, TRUE);
            
            HWND hDesc = CreateWindowA("STATIC", 
                "Download and install TuBlox Client",
                WS_CHILD | WS_VISIBLE | SS_CENTER,
                20, 45, 360, 20, hwnd, NULL, NULL, NULL);
            SendMessage(hDesc, WM_SETFONT, (WPARAM)hFont, TRUE);
            
            hProgressBar = CreateWindowExA(0, PROGRESS_CLASSA, NULL,
                WS_CHILD | WS_VISIBLE | PBS_SMOOTH,
                30, 85, 340, 20, hwnd, NULL, NULL, NULL);
            SendMessage(hProgressBar, PBM_SETRANGE, 0, MAKELPARAM(0, 100));
            
            hStatusText = CreateWindowA("STATIC", "Click Install to begin",
                WS_CHILD | WS_VISIBLE | SS_CENTER,
                20, 115, 360, 20, hwnd, NULL, NULL, NULL);
            SendMessage(hStatusText, WM_SETFONT, (WPARAM)hFont, TRUE);
            
            hInstallBtn = CreateWindowA("BUTTON", "Install",
                WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
                145, 150, 110, 35, hwnd, (HMENU)1, NULL, NULL);
            SendMessage(hInstallBtn, WM_SETFONT, (WPARAM)hFont, TRUE);
            
            return 0;
        }
        
        case WM_COMMAND: {
            if (LOWORD(wParam) == 1) {
                EnableWindow(hInstallBtn, FALSE);
                SetWindowTextA(hInstallBtn, "Installing...");
                
                if (DoInstall()) {
                    MessageBoxA(hwnd, 
                        "TuBlox installed successfully!\n\n"
                        "You can now play games from the website.\n"
                        "A shortcut was created on your desktop.",
                        "Done!", MB_OK | MB_ICONINFORMATION);
                    PostQuitMessage(0);
                } else {
                    MessageBoxA(hwnd,
                        "Installation failed.\n\n"
                        "Make sure the server is running\n"
                        "and try again.",
                        "Error", MB_OK | MB_ICONERROR);
                    EnableWindow(hInstallBtn, TRUE);
                    SetWindowTextA(hInstallBtn, "Retry");
                }
            }
            return 0;
        }
        
        case WM_CTLCOLORSTATIC: {
            SetBkMode((HDC)wParam, TRANSPARENT);
            SetTextColor((HDC)wParam, RGB(30, 30, 30));
            return (LRESULT)GetStockObject(WHITE_BRUSH);
        }
        
        case WM_ERASEBKGND: {
            RECT rc;
            GetClientRect(hwnd, &rc);
            FillRect((HDC)wParam, &rc, (HBRUSH)GetStockObject(WHITE_BRUSH));
            return 1;
        }
        
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    
    return DefWindowProcA(hwnd, msg, wParam, lParam);
}

// ============================================
// WinMain
// ============================================
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int nCmdShow) {
    INITCOMMONCONTROLSEX icc = { sizeof(icc), ICC_PROGRESS_CLASS };
    InitCommonControlsEx(&icc);
    
    WNDCLASSEXA wc = {0};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(WHITE_BRUSH);
    wc.lpszClassName = "TuBloxInstaller";
    wc.hIcon = LoadIcon(NULL, IDI_APPLICATION);
    RegisterClassExA(&wc);
    
    hMainWindow = CreateWindowExA(WS_EX_APPWINDOW, "TuBloxInstaller", "TuBlox Installer",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
        CW_USEDEFAULT, CW_USEDEFAULT, 420, 235, NULL, NULL, hInstance, NULL);
    
    // Центрируем
    RECT rc;
    GetWindowRect(hMainWindow, &rc);
    SetWindowPos(hMainWindow, NULL,
        (GetSystemMetrics(SM_CXSCREEN) - rc.right + rc.left) / 2,
        (GetSystemMetrics(SM_CYSCREEN) - rc.bottom + rc.top) / 2,
        0, 0, SWP_NOSIZE | SWP_NOZORDER);
    
    ShowWindow(hMainWindow, nCmdShow);
    
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    
    return 0;
}