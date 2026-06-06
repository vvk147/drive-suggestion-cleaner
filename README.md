# Drive Suggestion Cleaner

Drive Suggestion Cleaner is a small Chrome extension that marks Google Drive Home suggested files as **Not a helpful suggestion**, one by one.

It was built for people who use Google Drive heavily and want to clear noisy Home suggestions without deleting, moving, or trashing the underlying files.

## Features

- Runs only on `https://drive.google.com/drive/home`
- Scopes actions to the **Suggested files** section
- Avoids Suggested folders
- Clicks each file row's **More actions** menu and then **Not a helpful suggestion**
- Stop button for long runs
- Configurable max files
- Configurable run speed
- Optional **View more** handling
- Progress and activity log in the popup

## Install From Source

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository folder.
6. Open [Google Drive Home](https://drive.google.com/drive/home).
7. Click the extension icon and press **Run**.

## Options

- **Max files**: Upper bound for a run.
- **Delay**: Slower settings give Drive more time to update between dismissals.
- **Click View more when visible**: Loads more suggestions when the visible list runs out.
- **Stop if the first row does not change**: Prevents endless loops if Drive ignores a click.

## Safety

The extension does not delete, move, rename, download, upload, or share files. It only selects the Drive menu item labeled **Not a helpful suggestion**.

Google Drive's DOM changes over time, so keep **Stop if the first row does not change** enabled unless you are actively debugging.

## Development

```bash
npm run validate
npm run package
```

The package command creates `drive-suggestion-cleaner.zip`.

## License

MIT
