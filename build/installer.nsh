; Lumina setup additions (electron-builder picks this file up from the build folder by itself).
;
; customInit: when an older Lumina is already installed, ask before it is removed.
;   Yes = the setup carries on; electron-builder runs the old uninstaller quietly, then installs the new copy.
;   No  = the setup closes and nothing changes.
;   The folder page still shows afterwards. It starts on the old Lumina's folder and can be changed.
;   Projects, settings, recent files and the captions model live outside the install folder and are kept.
; customUnInstall: remove the ".lumina" file-type pointer the uninstaller used to leave behind.

!macro customInit
  ; Ask only once, and not during a quiet (/S) install or an automatic update.
  ${IfNot} ${UAC_IsInnerInstance}
  ${AndIfNot} ${Silent}
  ${AndIfNot} ${isUpdated}
    StrCpy $R8 ""
    StrCpy $R9 ""
    ReadRegStr $R8 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $R9 HKCU "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
    ${If} $R8 == ""
      ReadRegStr $R8 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
      ReadRegStr $R9 HKLM "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
    ${EndIf}
    ${If} $R8 != ""
      ${If} $R9 == ""
        StrCpy $R9 "(older version)"
      ${EndIf}
      MessageBox MB_YESNO|MB_ICONQUESTION "Lumina $R9 is already installed in:$\r$\n$R8$\r$\n$\r$\nRemove it and install Lumina ${VERSION}?$\r$\n$\r$\nYour projects, settings, recent files and the captions model are kept.$\r$\nYou can still choose the install folder on the next pages.$\r$\n$\r$\nNo closes this setup and leaves the old Lumina as it is." /SD IDYES IDYES luminaReplaceOld
      Quit
      luminaReplaceOld:
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ; Only on a real uninstall. During an update the new setup registers the file type again.
  ${IfNot} ${isUpdated}
    ReadRegStr $R0 SHELL_CONTEXT "Software\Classes\.lumina" ""
    ; Only if it still points at Lumina's own type, so another app's .lumina setting is never touched.
    ${If} $R0 == "Lumina Project"
      DeleteRegKey SHELL_CONTEXT "Software\Classes\.lumina"
    ${EndIf}
  ${EndIf}
!macroend
