param(
  [string]$Title = "逆熵 · 灵感雷达",
  [string]$Msg = "已更新今日 AI 资讯"
)

# 使用 Win10/11 原生 Toast（无需额外模块）
Add-Type -AssemblyName System.Windows.Forms
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null

$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$text = $template.GetElementsByTagName('text')
$text.Item(0).AppendChild($template.CreateTextNode($Title)) | Out-Null
$text.Item(1).AppendChild($template.CreateTextNode($Msg)) | Out-Null

$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('AntientropyNews')
$notifier.Show($template)
