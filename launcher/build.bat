@echo off
rem Builds Lumina.exe (with the Lumina icon) into the folder above this one.
cd /d "%~dp0"
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /win32icon:..\lumina.ico /r:System.Windows.Forms.dll /out:..\Lumina.exe Lumina.cs
