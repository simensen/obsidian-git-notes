import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { GitLabData } from 'gitlab'
import { DefaultCredentialsStore, MainData, Paths } from 'local'

const eventEmitter = new EventEmitter
const data = new MainData
const paths = new Paths('./')

const authPath = paths.generatePath('.auth.json')

const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

const credentialStore = new DefaultCredentialsStore(auth)

data.register(new GitLabData(eventEmitter, paths, credentialStore))

eventEmitter.on('entity.refresh', async event => {
	if (event.target_type === 'Issue') {
		await data.rebuildIssue(event.dataTarget, event.project_id, event.target_iid)
	}

	if (event.target_type === 'MergeRequest') {
		await data.rebuildMergeRequest(event.dataTarget, event.project_id, event.target_iid)
	}
})

const state = {
	lastUpdated: null
}

const refreshInMs = 15 * 60 * 1000
const skipInMs = refreshInMs

function rebuild(id: int, now) {
	state.lastUpdated = now
	console.log({rebuild: id, now})
	Object.entries(auth)
		.forEach(([type, hostnames]) => Object.keys(hostnames)
			.forEach(hostname => data.rebuild({type, hostname})))
}

function doIt() {
	const now = new Date()

	if (state.lastUpdated && (now - state.lastUpdated) < skipInMs) {
		console.log('skipping rebuild; built too recently')
		return
	}

	rebuild(1, now)
}

// Kicks off the regular updates.
setInterval(doIt, refreshInMs)

doIt()

// Kicks off a once-an-hour extra update just to keep things exciting
setInterval(() => rebuild(2, new Date()), 60 * 60 * 1000)
}
interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Git Notes Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open Git Notes modal (simple)',
			callback: () => {
				new GitNotesModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Git Notes editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Git Notes Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open Git Notes modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new GitNotesModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GitNotesSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		const paths = new Paths('.obsidian/plugins/obsidian-git-notes/data')

		console.log(await this.app.vault.adapter.list(path))
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class GitNotesModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class GitNotesSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
