; -------------------------------------------------------------
; TuStudio Installer Script
; -------------------------------------------------------------

#define TuStudioVersion "0.1.0"

[Setup]
AppName=TuStudio
AppVersion={#TuStudioVersion}
AppPublisher=TuBlox Corporation
AppPublisherURL=https://tublox.vercel.app
AppSupportURL=https://tublox.vercel.app
AppUpdatesURL=https://tublox.vercel.app
DefaultDirName={localappdata}\TuStudio
DefaultGroupName=TuStudio
OutputBaseFilename=TuStudioSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
DirExistsWarning=no
SetupIconFile=icon.ico
VersionInfoVersion={#TuStudioVersion}
VersionInfoCompany=TuBlox Corporation
VersionInfoDescription=TuStudio Installer
VersionInfoProductName=TuStudio
VersionInfoProductVersion={#TuStudioVersion}
VersionInfoCopyright=Copyright 2026 TuBlox Corporation
SignTool=mysign $f

[Icons]
Name: "{userdesktop}\TuStudio"; Filename: "{app}\TuStudio.exe"; IconFilename: "{app}\icon.ico"
Name: "{group}\TuStudio"; Filename: "{app}\TuStudio.exe"; IconFilename: "{app}\icon.ico"

[Code]
var
  DownloadPage: TDownloadWizardPage;

procedure InitializeWizard();
begin
  DownloadPage := CreateDownloadPage(
    'Installing TuStudio',
    'Please wait while TuStudio is being downloaded and installed...', nil);
end;

procedure CleanAppDirectory();
var
  AppDir: string;
begin
  AppDir := ExpandConstant('{app}');
  if DirExists(AppDir) then
    DelTree(AppDir, True, True, True);
  ForceDirectories(AppDir);
end;

procedure CreateProjectsFolder();
var
  ProjectsDir: string;
begin
  // Создаём папку Projects внутри TuStudio
  ProjectsDir := ExpandConstant('{app}\Projects');
  if not DirExists(ProjectsDir) then
    ForceDirectories(ProjectsDir);
end;

function ExtractZip(ZipPath: string; DestDir: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := False;

  if not FileExists(ZipPath) then
  begin
    MsgBox('ZIP file not found: ' + ZipPath, mbError, MB_OK);
    Exit;
  end;

  ForceDirectories(DestDir);

  // Сначала tar (Windows 10+)
  if Exec(ExpandConstant('{sys}\cmd.exe'),
    '/c tar -xf "' + ZipPath + '" -C "' + DestDir + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      Result := True;
      Exit;
    end;
  end;

  // Fallback PowerShell
  if Exec('powershell.exe',
    '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath \"' + ZipPath + '\" -DestinationPath \"' + DestDir + '\" -Force"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
      Result := True
    else
      MsgBox('Extraction failed: ' + IntToStr(ResultCode), mbError, MB_OK);
  end;
end;

procedure CreateShortcuts();
var
  ResultCode: Integer;
  AppDir: string;
  DesktopPath: string;
  Lines: TArrayOfString;
  ScriptFile: string;
begin
  AppDir      := ExpandConstant('{app}');
  DesktopPath := ExpandConstant('{userdesktop}');
  ScriptFile  := ExpandConstant('{tmp}\sc.ps1');

  SetArrayLength(Lines, 5);
  Lines[0] := '$ws = New-Object -ComObject WScript.Shell';
  Lines[1] := '$s = $ws.CreateShortcut("' + DesktopPath + '\TuStudio.lnk")';
  Lines[2] := '$s.TargetPath = "' + AppDir + '\TuStudio.exe"';
  Lines[3] := '$s.IconLocation = "' + AppDir + '\icon.ico"';
  Lines[4] := '$s.Save()';

  SaveStringsToFile(ScriptFile, Lines, False);

  Exec('powershell.exe',
    '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + ScriptFile + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  StudioZip: string;
  AppDir: string;
begin
  if CurStep = ssInstall then
  begin
    AppDir    := ExpandConstant('{app}');
    StudioZip := ExpandConstant('{tmp}\TuStudio.zip');

    // 1. Удаляем старое
    CleanAppDirectory();

    // 2. Загрузка
    DownloadPage.Clear;
    DownloadPage.Add(
      'https://tublox.vercel.app/download/TuStudio.zip',
      'TuStudio.zip', '');

    DownloadPage.Show;
    try
      DownloadPage.Download;
    except
      MsgBox('Download failed! Check your internet connection.', mbError, MB_OK);
      DownloadPage.Hide;
      Exit;
    end;
    DownloadPage.Hide;

    // 3. Распаковка
    if not ExtractZip(StudioZip, AppDir) then
      Exit;

    // 4. Создаём папку Projects
    CreateProjectsFolder();

    // 5. Ярлыки
    CreateShortcuts();
  end;
end;