' Starts VSIMS with pythonw.exe (the windowed Python interpreter), so no
' console window ever appears. Handy for development: no need to rebuild
' VSIMS.exe every time you change server.py or a static file.
'
' Stop the server via the tray icon's "Quit" option, or by ending
' pythonw.exe in Task Manager.

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = scriptDir
shell.Run "pythonw.exe """ & scriptDir & "\server.py""", 0, False
