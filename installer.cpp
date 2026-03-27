#include <windows.h>
#include <wininet.h>
#include <shlobj.h>
#include <commctrl.h>
#include <gdiplus.h>
#include <string>
#include <fstream>
#include <cmath>

#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "uuid.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "gdiplus.lib")

// Добавляем манифест для совместимости и доверия
#pragma comment(linker, "\"/manifestdependency:type='win32' \
    name='Microsoft.Windows.Common-Controls' version='6.0.0.0' \
    processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")

using namespace Gdiplus;

// Изменённая ссылка на Vercel
const wchar_t* g_downloadHost = L"tublox.vercel.app";
const wchar_t* g_downloadPath = L"/download/TuClient.zip";
const wchar_t* g_installFolder = L"TuBlox";
const wchar_t* g_clientExe = L"TuClient.exe";
const wchar_t* g_zipFolderInside = L"TuClient";

HWND g_hMainWindow = NULL;
int g_currentProgress = 0;
wchar_t g_statusText[256] = L"Click Install to begin";
bool g_isInstalling = false;
bool g_installSuccess = false;
bool g_installError = false;
float g_spinnerAngle = 0.0f;
ULONG_PTR g_gdiplusToken;

// Функция для безопасного обновления прогресса
void UpdateProgress(int percent, const wchar_t* status) {
    g_currentProgress = percent;
    wcscpy_s(g_statusText, status);
    InvalidateRect(g_hMainWindow, NULL, FALSE);
    
    MSG msg;
    while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
}

std::wstring GetInstallPath() {
    wchar_t localAppData[MAX_PATH];
    if (SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, localAppData) == S_OK) {
        return std::wstring(localAppData) + L"\\" + g_installFolder;
    }
    return L"C:\\TuBlox";
}

std::wstring GetTempFilePath() {
    wchar_t tempPath[MAX_PATH];
    GetTempPathW(MAX_PATH, tempPath);
    return std::wstring(tempPath) + L"TuClient_download.zip";
}

// Улучшенная функция загрузки - использует HTTPS явно
bool DownloadFile(const std::wstring& savePath) {
    UpdateProgress(5, L"Connecting to server...");
    
    // Используем стандартный User-Agent
    HINTERNET hInternet = InternetOpenW(
        L"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", 
        INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
    
    if (!hInternet) {
        UpdateProgress(0, L"Connection failed");
        return false;
    }
    
    DWORD timeout = 60000;
    InternetSetOptionW(hInternet, INTERNET_OPTION_CONNECT_TIMEOUT, &timeout, sizeof(timeout));
    InternetSetOptionW(hInternet, INTERNET_OPTION_RECEIVE_TIMEOUT, &timeout, sizeof(timeout));
    
    UpdateProgress(10, L"Connecting...");
    
    // Подключаемся к серверу
    HINTERNET hConnect = InternetConnectW(
        hInternet,
        g_downloadHost,
        INTERNET_DEFAULT_HTTPS_PORT,
        NULL, NULL,
        INTERNET_SERVICE_HTTP,
        0, 0);
    
    if (!hConnect) {
        DWORD err = GetLastError();
        wchar_t msg[64];
        swprintf_s(msg, L"Connection error: %lu", err);
        UpdateProgress(0, msg);
        InternetCloseHandle(hInternet);
        return false;
    }
    
    // Создаём HTTPS запрос
    DWORD flags = INTERNET_FLAG_SECURE | INTERNET_FLAG_RELOAD | 
                  INTERNET_FLAG_NO_CACHE_WRITE | INTERNET_FLAG_KEEP_CONNECTION;
    
    HINTERNET hRequest = HttpOpenRequestW(
        hConnect,
        L"GET",
        g_downloadPath,
        NULL, NULL, NULL,
        flags, 0);
    
    if (!hRequest) {
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        UpdateProgress(0, L"Request failed");
        return false;
    }
    
    // Отправляем запрос
    if (!HttpSendRequestW(hRequest, NULL, 0, NULL, 0)) {
        DWORD err = GetLastError();
        wchar_t msg[64];
        swprintf_s(msg, L"Send error: %lu", err);
        UpdateProgress(0, msg);
        InternetCloseHandle(hRequest);
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        return false;
    }
    
    // Проверяем статус
    DWORD statusCode = 0;
    DWORD size = sizeof(statusCode);
    HttpQueryInfoW(hRequest, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER, 
        &statusCode, &size, NULL);
    
    if (statusCode >= 400) {
        wchar_t msg[64];
        swprintf_s(msg, L"Server error: %lu", statusCode);
        UpdateProgress(0, msg);
        InternetCloseHandle(hRequest);
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        return false;
    }
    
    // Получаем размер файла
    wchar_t sizeBuffer[32] = {0};
    DWORD sizeBufferLen = sizeof(sizeBuffer);
    DWORD idx = 0;
    DWORD totalSize = 0;
    
    if (HttpQueryInfoW(hRequest, HTTP_QUERY_CONTENT_LENGTH, sizeBuffer, &sizeBufferLen, &idx)) {
        totalSize = _wtoi(sizeBuffer);
    }
    
    // Создаём файл
    HANDLE hFile = CreateFileW(savePath.c_str(), GENERIC_WRITE, 0, NULL, 
        CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    
    if (hFile == INVALID_HANDLE_VALUE) {
        UpdateProgress(0, L"Cannot create file");
        InternetCloseHandle(hRequest);
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        return false;
    }
    
    // Читаем и записываем данные
    char buffer[8192];
    DWORD bytesRead = 0;
    DWORD totalRead = 0;
    DWORD bytesWritten = 0;
    
    while (InternetReadFile(hRequest, buffer, sizeof(buffer), &bytesRead) && bytesRead > 0) {
        WriteFile(hFile, buffer, bytesRead, &bytesWritten, NULL);
        totalRead += bytesRead;
        
        int percent = 15;
        if (totalSize > 0) {
            percent = 15 + (int)((totalRead * 45) / totalSize);
        }
        
        wchar_t status[128];
        if (totalSize > 0) {
            swprintf_s(status, L"Downloading: %.1f / %.1f MB", 
                totalRead / 1048576.0f, totalSize / 1048576.0f);
        } else {
            swprintf_s(status, L"Downloading: %.1f MB", totalRead / 1048576.0f);
        }
        UpdateProgress(percent, status);
    }
    
    CloseHandle(hFile);
    InternetCloseHandle(hRequest);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    
    if (totalRead < 1000) {
        UpdateProgress(0, L"Download incomplete");
        DeleteFileW(savePath.c_str());
        return false;
    }
    
    return true;
}

bool ExtractZip(const std::wstring& zipPath, const std::wstring& destPath) {
    UpdateProgress(65, L"Extracting files...");
    
    CreateDirectoryW(destPath.c_str(), NULL);
    
    // Используем COM Shell для распаковки (менее подозрительно для антивирусов)
    IShellDispatch* pShellDisp = NULL;
    CoInitialize(NULL);
    
    HRESULT hr = CoCreateInstance(CLSID_Shell, NULL, CLSCTX_INPROC_SERVER, 
        IID_IShellDispatch, (void**)&pShellDisp);
    
    if (FAILED(hr) || !pShellDisp) {
        // Fallback на PowerShell
        std::wstring cmd = L"powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"";
        cmd += L"Expand-Archive -LiteralPath '";
        cmd += zipPath;
        cmd += L"' -DestinationPath '";
        cmd += destPath;
        cmd += L"' -Force\"";
        
        STARTUPINFOW si = {0};
        si.cb = sizeof(si);
        si.dwFlags = STARTF_USESHOWWINDOW;
        si.wShowWindow = SW_HIDE;
        
        PROCESS_INFORMATION pi = {0};
        
        if (!CreateProcessW(NULL, (LPWSTR)cmd.c_str(), NULL, NULL, FALSE, 
            CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
            CoUninitialize();
            UpdateProgress(0, L"Extraction failed to start");
            return false;
        }
        
        int dots = 0;
        while (WaitForSingleObject(pi.hProcess, 300) == WAIT_TIMEOUT) {
            dots = (dots + 1) % 4;
            wchar_t status[32];
            swprintf_s(status, L"Extracting%.*s", dots + 1, L"...");
            UpdateProgress(70 + (dots * 2), status);
        }
        
        DWORD exitCode = 1;
        GetExitCodeProcess(pi.hProcess, &exitCode);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        CoUninitialize();
        
        if (exitCode != 0) {
            UpdateProgress(0, L"Extraction failed");
            return false;
        }
        
        return true;
    }
    
    pShellDisp->Release();
    CoUninitialize();
    
    // Если COM Shell доступен, используем PowerShell как fallback
    std::wstring cmd = L"powershell.exe -NoProfile -Command \"Expand-Archive -LiteralPath '";
    cmd += zipPath + L"' -DestinationPath '" + destPath + L"' -Force\"";
    
    STARTUPINFOW si = {0};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    
    PROCESS_INFORMATION pi = {0};
    
    CreateProcessW(NULL, (LPWSTR)cmd.c_str(), NULL, NULL, FALSE, 
        CREATE_NO_WINDOW, NULL, NULL, &si, &pi);
    
    WaitForSingleObject(pi.hProcess, INFINITE);
    
    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    
    return exitCode == 0;
}

std::wstring FindClientExe(const std::wstring& installPath) {
    std::wstring path1 = installPath + L"\\" + g_zipFolderInside + L"\\" + g_clientExe;
    if (GetFileAttributesW(path1.c_str()) != INVALID_FILE_ATTRIBUTES) return path1;
    
    std::wstring path2 = installPath + L"\\" + g_clientExe;
    if (GetFileAttributesW(path2.c_str()) != INVALID_FILE_ATTRIBUTES) return path2;
    
    WIN32_FIND_DATAW fd;
    HANDLE hFind = FindFirstFileW((installPath + L"\\*").c_str(), &fd);
    if (hFind != INVALID_HANDLE_VALUE) {
        do {
            if ((fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) &&
                wcscmp(fd.cFileName, L".") != 0 && wcscmp(fd.cFileName, L"..") != 0) {
                std::wstring subPath = installPath + L"\\" + fd.cFileName + L"\\" + g_clientExe;
                if (GetFileAttributesW(subPath.c_str()) != INVALID_FILE_ATTRIBUTES) {
                    FindClose(hFind);
                    return subPath;
                }
            }
        } while (FindNextFileW(hFind, &fd));
        FindClose(hFind);
    }
    return L"";
}

bool RegisterProtocol(const std::wstring& exePath) {
    UpdateProgress(85, L"Registering protocol...");
    
    HKEY hKey;
    
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Classes\\tublox", 
        0, NULL, REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL) != ERROR_SUCCESS) {
        return false;
    }
    
    const wchar_t* desc = L"URL:TuBlox Protocol";
    RegSetValueExW(hKey, NULL, 0, REG_SZ, (BYTE*)desc, (DWORD)(wcslen(desc) + 1) * sizeof(wchar_t));
    RegSetValueExW(hKey, L"URL Protocol", 0, REG_SZ, (BYTE*)L"", sizeof(wchar_t));
    RegCloseKey(hKey);
    
    std::wstring iconPath = L"\"" + exePath + L"\",0";
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Classes\\tublox\\DefaultIcon",
        0, NULL, REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL) == ERROR_SUCCESS) {
        RegSetValueExW(hKey, NULL, 0, REG_SZ, (BYTE*)iconPath.c_str(), 
            (DWORD)(iconPath.size() + 1) * sizeof(wchar_t));
        RegCloseKey(hKey);
    }
    
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Classes\\tublox\\shell\\open\\command",
        0, NULL, REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL) == ERROR_SUCCESS) {
        std::wstring command = L"\"" + exePath + L"\" \"%1\"";
        RegSetValueExW(hKey, NULL, 0, REG_SZ, (BYTE*)command.c_str(), 
            (DWORD)(command.size() + 1) * sizeof(wchar_t));
        RegCloseKey(hKey);
    }
    
    return true;
}

bool CreateDesktopShortcut(const std::wstring& exePath) {
    UpdateProgress(93, L"Creating shortcut...");
    
    CoInitialize(NULL);
    
    IShellLinkW* pLink = NULL;
    if (SUCCEEDED(CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, 
        IID_IShellLinkW, (void**)&pLink))) {
        pLink->SetPath(exePath.c_str());
        pLink->SetDescription(L"TuBlox Client");
        
        size_t pos = exePath.find_last_of(L"\\/");
        if (pos != std::wstring::npos) {
            pLink->SetWorkingDirectory(exePath.substr(0, pos).c_str());
        }
        
        wchar_t desktop[MAX_PATH];
        SHGetFolderPathW(NULL, CSIDL_DESKTOPDIRECTORY, NULL, 0, desktop);
        
        IPersistFile* pFile = NULL;
        if (SUCCEEDED(pLink->QueryInterface(IID_IPersistFile, (void**)&pFile))) {
            std::wstring shortcutPath = std::wstring(desktop) + L"\\TuBlox.lnk";
            pFile->Save(shortcutPath.c_str(), TRUE);
            pFile->Release();
        }
        pLink->Release();
    }
    
    CoUninitialize();
    return true;
}

DWORD WINAPI InstallThread(LPVOID) {
    std::wstring installPath = GetInstallPath();
    std::wstring zipPath = GetTempFilePath();
    
    g_isInstalling = true;
    g_installSuccess = false;
    g_installError = false;
    
    if (!DownloadFile(zipPath)) {
        g_installError = true;
        g_isInstalling = false;
        InvalidateRect(g_hMainWindow, NULL, FALSE);
        return 1;
    }
    
    if (!ExtractZip(zipPath, installPath)) {
        DeleteFileW(zipPath.c_str());
        UpdateProgress(0, L"Extraction failed");
        g_installError = true;
        g_isInstalling = false;
        InvalidateRect(g_hMainWindow, NULL, FALSE);
        return 1;
    }
    
    DeleteFileW(zipPath.c_str());
    
    std::wstring clientExe = FindClientExe(installPath);
    if (clientExe.empty()) {
        UpdateProgress(0, L"TuClient.exe not found");
        g_installError = true;
        g_isInstalling = false;
        InvalidateRect(g_hMainWindow, NULL, FALSE);
        return 1;
    }
    
    RegisterProtocol(clientExe);
    CreateDesktopShortcut(clientExe);
    
    UpdateProgress(100, L"Installation complete!");
    g_installSuccess = true;
    g_isInstalling = false;
    InvalidateRect(g_hMainWindow, NULL, FALSE);
    
    return 0;
}

void DrawRoundedRect(Graphics& g, int x, int y, int w, int h, int r, Color fill, Color border) {
    GraphicsPath path;
    path.AddArc(x, y, r * 2, r * 2, 180, 90);
    path.AddArc(x + w - r * 2, y, r * 2, r * 2, 270, 90);
    path.AddArc(x + w - r * 2, y + h - r * 2, r * 2, r * 2, 0, 90);
    path.AddArc(x, y + h - r * 2, r * 2, r * 2, 90, 90);
    path.CloseFigure();
    
    SolidBrush brush(fill);
    g.FillPath(&brush, &path);
    
    Pen pen(border, 1);
    g.DrawPath(&pen, &path);
}

void DrawSpinner(Graphics& g, int cx, int cy, int radius) {
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    
    Pen bgPen(Color(40, 255, 255, 255), 3);
    g.DrawEllipse(&bgPen, cx - radius, cy - radius, radius * 2, radius * 2);
    
    float startAngle = g_spinnerAngle;
    float sweepAngle = 240;
    
    Pen arcPen(Color(255, 255, 255, 255), 3);
    arcPen.SetStartCap(LineCapRound);
    arcPen.SetEndCap(LineCapRound);
    
    g.DrawArc(&arcPen, cx - radius, cy - radius, radius * 2, radius * 2, startAngle, sweepAngle);
}

void DrawCheckmark(Graphics& g, int cx, int cy, int size) {
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    
    SolidBrush circleBrush(Color(255, 34, 197, 94));
    g.FillEllipse(&circleBrush, cx - size, cy - size, size * 2, size * 2);
    
    Pen checkPen(Color(255, 255, 255, 255), 3);
    checkPen.SetStartCap(LineCapRound);
    checkPen.SetEndCap(LineCapRound);
    checkPen.SetLineJoin(LineJoinRound);
    
    Point points[3] = {
        Point(cx - size/3, cy),
        Point(cx - size/10, cy + size/3),
        Point(cx + size/3, cy - size/4)
    };
    g.DrawLines(&checkPen, points, 3);
}

void DrawError(Graphics& g, int cx, int cy, int size) {
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    
    SolidBrush circleBrush(Color(255, 255, 51, 51));
    g.FillEllipse(&circleBrush, cx - size, cy - size, size * 2, size * 2);
    
    Pen xPen(Color(255, 255, 255, 255), 3);
    xPen.SetStartCap(LineCapRound);
    xPen.SetEndCap(LineCapRound);
    
    int offset = size / 3;
    g.DrawLine(&xPen, cx - offset, cy - offset, cx + offset, cy + offset);
    g.DrawLine(&xPen, cx + offset, cy - offset, cx - offset, cy + offset);
}

void OnPaint(HWND hwnd) {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hwnd, &ps);
    
    RECT rc;
    GetClientRect(hwnd, &rc);
    int w = rc.right;
    int h = rc.bottom;
    
    HDC memDC = CreateCompatibleDC(hdc);
    HBITMAP memBitmap = CreateCompatibleBitmap(hdc, w, h);
    SelectObject(memDC, memBitmap);
    
    Graphics g(memDC);
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);
    
    SolidBrush bgBrush(Color(255, 0, 0, 0));
    g.FillRectangle(&bgBrush, 0, 0, w, h);
    
    DrawRoundedRect(g, 20, 20, w - 40, h - 40, 16, Color(255, 10, 10, 10), Color(255, 26, 26, 26));
    
    FontFamily fontFamily(L"Segoe UI");
    Font titleFont(&fontFamily, 24, FontStyleBold, UnitPixel);
    Font normalFont(&fontFamily, 14, FontStyleRegular, UnitPixel);
    
    SolidBrush whiteBrush(Color(255, 255, 255, 255));
    SolidBrush grayBrush(Color(255, 119, 119, 119));
    
    StringFormat centerFormat;
    centerFormat.SetAlignment(StringAlignmentCenter);
    
    RectF titleRect(0, 40, (float)w, 30);
    g.DrawString(L"TuBlox Installer", -1, &titleFont, titleRect, &centerFormat, &whiteBrush);
    
    int centerY = 130;
    
    if (g_isInstalling) {
        DrawSpinner(g, w/2, centerY, 25);
    } else if (g_installSuccess) {
        DrawCheckmark(g, w/2, centerY, 25);
    } else if (g_installError) {
        DrawError(g, w/2, centerY, 25);
    }
    
    if (g_isInstalling || g_installSuccess) {
        int barX = 50;
        int barY = centerY + 50;
        int barW = w - 100;
        int barH = 6;
        
        DrawRoundedRect(g, barX, barY, barW, barH, 3, Color(255, 26, 26, 26), Color(255, 26, 26, 26));
        
        if (g_currentProgress > 0) {
            int fillW = (barW * g_currentProgress) / 100;
            if (fillW > 6) {
                DrawRoundedRect(g, barX, barY, fillW, barH, 3, Color(255, 255, 255, 255), Color(255, 255, 255, 255));
            }
        }
    }
    
    RectF statusRect(0, (float)(centerY + 70), (float)w, 20);
    g.DrawString(g_statusText, -1, &normalFont, statusRect, &centerFormat, &grayBrush);
    
    if (!g_isInstalling) {
        int btnX = w/2 - 70;
        int btnY = h - 85;
        int btnW = 140;
        int btnH = 42;
        
        Color btnColor = g_installSuccess ? Color(255, 34, 197, 94) : Color(255, 255, 255, 255);
        Color textColor = g_installSuccess ? Color(255, 255, 255, 255) : Color(255, 0, 0, 0);
        
        if (g_installError) {
            btnColor = Color(255, 255, 255, 255);
        }
        
        DrawRoundedRect(g, btnX, btnY, btnW, btnH, 10, btnColor, btnColor);
        
        Font btnFont(&fontFamily, 15, FontStyleBold, UnitPixel);
        SolidBrush btnTextBrush(textColor);
        
        const wchar_t* btnText = L"Install";
        if (g_installSuccess) btnText = L"Done";
        else if (g_installError) btnText = L"Retry";
        
        RectF btnRect((float)btnX, (float)btnY + 12, (float)btnW, 20);
        g.DrawString(btnText, -1, &btnFont, btnRect, &centerFormat, &btnTextBrush);
    }
    
    BitBlt(hdc, 0, 0, w, h, memDC, 0, 0, SRCCOPY);
    
    DeleteObject(memBitmap);
    DeleteDC(memDC);
    
    EndPaint(hwnd, &ps);
}

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE:
            SetTimer(hwnd, 1, 16, NULL);
            return 0;
            
        case WM_TIMER:
            if (g_isInstalling) {
                g_spinnerAngle += 8;
                if (g_spinnerAngle >= 360) g_spinnerAngle -= 360;
                InvalidateRect(hwnd, NULL, FALSE);
            }
            return 0;
            
        case WM_PAINT:
            OnPaint(hwnd);
            return 0;
            
        case WM_LBUTTONUP: {
            if (g_isInstalling) return 0;
            
            int x = LOWORD(lParam);
            int y = HIWORD(lParam);
            
            RECT rc;
            GetClientRect(hwnd, &rc);
            int w = rc.right;
            int h = rc.bottom;
            
            int btnX = w/2 - 70;
            int btnY = h - 85;
            int btnW = 140;
            int btnH = 42;
            
            if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
                if (g_installSuccess) {
                    PostQuitMessage(0);
                } else {
                    CreateThread(NULL, 0, InstallThread, NULL, 0, NULL);
                }
            }
            return 0;
        }
        
        case WM_SETCURSOR: {
            POINT pt;
            GetCursorPos(&pt);
            ScreenToClient(hwnd, &pt);
            
            RECT rc;
            GetClientRect(hwnd, &rc);
            int w = rc.right;
            int h = rc.bottom;
            
            int btnX = w/2 - 70;
            int btnY = h - 85;
            int btnW = 140;
            int btnH = 42;
            
            if (!g_isInstalling && pt.x >= btnX && pt.x <= btnX + btnW && 
                pt.y >= btnY && pt.y <= btnY + btnH) {
                SetCursor(LoadCursor(NULL, IDC_HAND));
                return TRUE;
            }
            break;
        }
        
        case WM_DESTROY:
            KillTimer(hwnd, 1);
            PostQuitMessage(0);
            return 0;
    }
    
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, LPWSTR, int nCmdShow) {
    GdiplusStartupInput gdiplusStartupInput;
    GdiplusStartup(&g_gdiplusToken, &gdiplusStartupInput, NULL);
    
    INITCOMMONCONTROLSEX icc = { sizeof(icc), ICC_PROGRESS_CLASS };
    InitCommonControlsEx(&icc);
    
    WNDCLASSEXW wc = {0};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    wc.lpszClassName = L"TuBloxInstallerClass";
    wc.hIcon = LoadIcon(NULL, IDI_APPLICATION);
    RegisterClassExW(&wc);
    
    int winW = 400;
    int winH = 320;
    
    g_hMainWindow = CreateWindowExW(
        WS_EX_APPWINDOW,
        L"TuBloxInstallerClass",
        L"TuBlox Installer",
        WS_POPUP | WS_VISIBLE,
        (GetSystemMetrics(SM_CXSCREEN) - winW) / 2,
        (GetSystemMetrics(SM_CYSCREEN) - winH) / 2,
        winW, winH,
        NULL, NULL, hInstance, NULL
    );
    
    ShowWindow(g_hMainWindow, nCmdShow);
    
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    
    GdiplusShutdown(g_gdiplusToken);
    
    return 0;
}