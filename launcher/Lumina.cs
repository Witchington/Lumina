// Lumina launcher: opens Lumina.html in its own app window (Edge or Chrome app mode).
// Rebuild with build.bat after changing this file.
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

static class Lumina
{
    static string FindBrowser(string exe)
    {
        foreach (var root in new[] { Registry.CurrentUser, Registry.LocalMachine })
        {
            using (var k = root.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
            {
                var p = k == null ? null : k.GetValue("") as string;
                if (!string.IsNullOrEmpty(p) && File.Exists(p)) return p;
            }
        }
        return null;
    }

    [STAThread]
    static void Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string page = Path.Combine(dir, "Lumina.html");
        if (!File.Exists(page))
        {
            MessageBox.Show("Lumina.html is missing. Keep Lumina.exe in the same folder as Lumina.html.", "Lumina", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        string url = new Uri(page).AbsoluteUri;
        string browser = FindBrowser("msedge.exe") ?? FindBrowser("chrome.exe");
        if (browser == null)
        {
            Process.Start(url);
            return;
        }
        // Separate profile so Lumina gets its own window and taskbar entry. Extensions and sync are off:
        // otherwise Edge signs the profile in, syncs the user's extensions and opens their welcome tabs.
        string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Lumina", "app-profile");
        Process.Start(new ProcessStartInfo(browser,
            "--app=\"" + url + "\" --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check" +
            " --disable-extensions --disable-sync --disable-features=msImplicitSignin,msEdgeWelcomePage --window-size=1600,950")
        { UseShellExecute = false });
    }
}
