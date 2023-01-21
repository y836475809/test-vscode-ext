// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as path from 'path';
import * as vscode from 'vscode';

import {
	ExecuteCommandRequest,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	State,
	TransportKind
} from 'vscode-languageclient/node';
import { TreeDataProvider } from './treeDataProvider';
import { Project } from './project';
import * as fs from "fs";

let client: LanguageClient;

function getWorkspacePath(): string | undefined{
	const wf = vscode.workspace.workspaceFolders;
	return (wf && (wf.length > 0)) ? wf[0].uri.fsPath : undefined;
}

async function setupFiles(context: vscode.ExtensionContext){
	const wsPath = getWorkspacePath();
	if(!wsPath){
		return;
	}
	const project = new Project();
	await project.setupConfig();
	for(const fn of ["collection.cls", "dictionary.cls"]){
		await project.copy( 
			context.asAbsolutePath(`assets/${fn}`), 
			path.join(wsPath, ".vscode", fn));
	}
}

async function renameFiles(files: any[]){
	const method: Hoge.RequestMethod = "renameFiles";
	let renameParams: Hoge.RequestRenameParam[] = [];
	for(const file of files){
		const oldUri = file.oldUri.toString();
		const newUri = file.newUri.toString();
		renameParams.push({
			oldUri: oldUri,
			newUri: newUri
		});
	}
	await client.sendRequest(method, {renameParams});
}

function debounce(fn: any, interval: number){
    let timerId: any;
    return (e: any) => {
		if(timerId){
			clearTimeout(timerId);
		}
        timerId = setTimeout(() => {
            fn(e);
        }, interval);
    };
};

function setupWorkspaceFileEvent(context: vscode.ExtensionContext){
	vscode.workspace.onDidCreateFiles(async (e: vscode.FileCreateEvent) => {
		if(!client || client.state !== State.Running){
			return;
		}
		const method: Hoge.RequestMethod = "createFiles";
		const uris = e.files.map(uri => uri.toString());
		await client.sendRequest(method, {uris});
	}, null, context.subscriptions);
	vscode.workspace.onDidDeleteFiles(async (e: vscode.FileDeleteEvent) => {
		if(!client || client.state !== State.Running){
			return;
		}
		const method: Hoge.RequestMethod = "deleteFiles";
		const uris = e.files.map(uri => {
			return uri.toString();
		});
		await client.sendRequest(method, {uris});
	}, null, context.subscriptions);
	vscode.workspace.onDidRenameFiles(async (e: vscode.FileRenameEvent) => {
		if(!client || client.state !== State.Running){
			return;
		}
		const files = e.files.map(file => {
			return {
				oldUri: file.oldUri,
				newUri: file.newUri
			};
		});
		await renameFiles(files);
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(
		debounce(async (e: vscode.TextDocumentChangeEvent) => {
			if(!client || client.state !== State.Running){
				return;
			}
			if(e.document.isUntitled){
				return;
			}
			if(!e.document.isDirty && !e.reason){
				// 変更なしでsave
				return;
			}
			// isDirty=false, e.reason!=undefined
			// ->undo or redoで変更をもどした場合なので更新通知必要

			const wsPath = getWorkspacePath();
			const fname = e.document.fileName;
			if(path.dirname(fname) !== wsPath){
				return;
			}
			const method: Hoge.RequestMethod = "changeText";
			const uri = e.document.uri.toString();
			await client.sendRequest(method, {uri});
	}, 500), null, context.subscriptions);
}

async function startLanguageServer(context: vscode.ExtensionContext){
	let serverModule = context.asAbsolutePath(path.join('out', 'lsp-connection.js'));
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};
	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'vb' },]
	};
	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

async function stopLanguageServer(){
	if (client && client.state === State.Running) {
		await client.stop();
	}
}

async function waitUntilClientIsRunning(){
	let waitCount = 0;
	while(true){
		if(waitCount > 30){
			throw new Error("Timed out waiting for client ready");
		}
		waitCount++;
		await new Promise(resolve => {
			setTimeout(resolve, 100);
		});
		if(client.state === State.Running){
			break;
		}
	}
}

function getWorkspaceFileUris() : string[] | undefined{
	const wsPath = getWorkspacePath();
	if(!wsPath){
		return undefined;
	}
	let filePaths: string[] = [];
	const dirPaths = [wsPath, path.join(wsPath, ".vscode")];
	for(const dirPath of  dirPaths){
		const fsPaths = fs.readdirSync(dirPath, { withFileTypes: true })
		.filter(dirent => {
			return dirent.isFile() 
				&& (dirent.name.endsWith('.bas') || dirent.name.endsWith('.cls'));
		}).map(dirent => path.join(dirPath, dirent.name));
		filePaths = filePaths.concat(fsPaths);
	} 
	const uris = filePaths.map(fp => vscode.Uri.file(fp).toString());
	return uris;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	setupWorkspaceFileEvent(context);

	context.subscriptions.push(vscode.commands.registerCommand("sample-ext1.setupFiles", async () => {
		await setupFiles(context);
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sample-ext1.stopLanguageServer", async () => {
		await stopLanguageServer();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sample-ext1.startLanguageServer", async () => {
		await stopLanguageServer();
		await startLanguageServer(context);	

		await waitUntilClientIsRunning();
		const uris = getWorkspaceFileUris();
		if(uris){
			const method: Hoge.RequestMethod = "createFiles";
			await client.sendRequest(method, {uris});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sample-ext1.start", async () => {
		await setupFiles(context);
		await stopLanguageServer();
		await startLanguageServer(context);	

		await waitUntilClientIsRunning();
		const uris = getWorkspaceFileUris();
		if(uris){
			const method: Hoge.RequestMethod = "createFiles";
			await client.sendRequest(method, {uris});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sample-ext1.renameFiles", async (oldUri, newUri) => {
		await renameFiles([{
			oldUri,
			newUri
		}]);
	}));
}

// This method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
