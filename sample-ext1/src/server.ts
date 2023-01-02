import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    DefinitionParams,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    Location,
    HoverParams,
    Hover,
    MarkupContent
  } from 'vscode-languageserver/node';
  
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import * as fs from "fs";
import { getComdData } from "./ts-client";
import path = require('path');

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let hasWorkspaceFolderCapability: boolean = false;
const changedDocSet = new Set<string>();
const textDocumentMap = new Map<string, TextDocument>();

const symbolKindMap = new Map<string, CompletionItemKind>([
    ["Method", CompletionItemKind.Method],
    ["Field", CompletionItemKind.Field],
]);

connection.onInitialize((params: InitializeParams) => {
    let capabilities = params.capabilities;
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: false,
                // triggerCharacters: ["."]
                // triggerCharacters: ['--'],
                // completionItem: 
            },
            definitionProvider: true,
            // // Tell the client that this server supports hover.
            hoverProvider: true,
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onExecuteCommand(async (params) => {
    if(params.command === "create"){
        const uri = params.arguments?params.arguments[0]:undefined;
        const fp = URI.parse(uri).fsPath;
        const data = JSON.stringify({
            Id: "AddDocuments",
            FilePaths: [fp],
            Position: 0,
            Text: ""
        }); 
        const item = JSON.parse(await getComdData(data));
        const text = item.Texts[0];
        textDocumentMap.set(uri, TextDocument.create(
            uri, "vb", 0, text));
        changedDocSet.add(uri);
    }
    if(params.command === "delete"){
        const uri = params.arguments?params.arguments[0]:undefined;
        const fp = URI.parse(uri).fsPath;
        const data = JSON.stringify({
            Id: "DeleteDocuments",
            FilePaths: [fp],
            Position: 0,
            Text: ""
        });   
        await getComdData(data);
        textDocumentMap.delete(uri);
        changedDocSet.delete(uri);
    }
});

// let all_bk:TextDocument[] = []
connection.onInitialized(async () => {
    // if (hasConfigurationCapability) {
    //     // Register for all configuration changes.
    //     connection.client.register(DidChangeConfigurationNotification.type, undefined);
    // }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
        // connection.workspace.onDidDeleteFiles(async params => {
        //     params.files.forEach(file => {
        //         textDocumentMap.delete(file.uri);
        //     });
        //     for (let index = 0; index < params.files.length; index++) {
        //         const file = params.files[index];
        //         const fp = URI.parse(file.uri).fsPath;
        //         const data = JSON.stringify({
        //             Id: "DeleteDocument",
        //             FilePath: fp,
        //             Position: 0,
        //             Text: ""
        //         });   
        //         await getComdData(data);
        //     }
        // });
        // connection.workspace.onDidRenameFiles(async params => {
        //     for (let index = 0; index < params.files.length; index++) {
        //         const file = params.files[index];
        //         const oldfp = URI.parse(file.oldUri).fsPath;
        //         const newfp = URI.parse(file.newUri).fsPath;
        //         const data = JSON.stringify({
        //             Id: "RenameDocument",
        //             OldFilePath: oldfp,
        //             NewFilePath: newfp,
        //         });   
        //         await getComdData(data);
        //     }
        // });
    }
    const wfs = await connection.workspace.getWorkspaceFolders();
    const rootPath = (wfs && (wfs.length > 0)) ? URI.parse(wfs[0].uri).fsPath: undefined;
    if(rootPath){
        let allPaths:string[] = [];
        for(const fp of [rootPath, path.join(rootPath, ".vscode")]){
            const fsPaths = fs.readdirSync(fp, { withFileTypes: true })
            .filter(dirent => {
                return dirent.isFile() 
                    && (dirent.name.endsWith('.bas') || dirent.name.endsWith('.cls'));
            }).map(dirent => path.join(fp, dirent.name));
            allPaths = allPaths.concat(fsPaths);
        }
        // fs.writeFileSync("pp.txt", allPaths.join("\n"));
        const data = JSON.stringify({
            Id: "AddDocuments",
            FilePaths: allPaths,
            Position: 0,
            Text: ""
        }); 
        const item = JSON.parse(await getComdData(data));
        for (let index = 0; index < item.FilePaths.length; index++) {
            const uri = URI.file(item.FilePaths[index]).toString();
            const text = item.Texts[index];
            textDocumentMap.set(uri, TextDocument.create(
                uri, "vb", 0, text));
        }
        // for (let index = 0; index < allPaths.length; index++) {
        //     const fp = allPaths[index];
        //     const data = JSON.stringify({
        //         Id: "AddDocuments",
        //         FilePaths: allPaths,
        //         Position: 0,
        //         Text: ""
        //     });
        //     const uri = URI.file(fp).toString();
        //     const item = JSON.parse(await getComdData(data));
        //     textDocumentMap.set(uri, TextDocument.create(
        //         uri, "vb", 0, item.Text));
        // }
    }
});

documents.onDidChangeContent(change => {
    let m = 0;
    // let all_bk = documents.all();
    console.log("change=", change);
    // change.document.getText();
    // alidateTextDocument(change.document);
    // change.document.positionAt()
    const uri = change.document.uri;
    textDocumentMap.set(uri, TextDocument.create(
        uri, "vb", 0, change.document.getText()));
    changedDocSet.add(change.document.uri);
});

documents.onDidSave(async change => {
    console.log("onDidSave change=", change);
    const doc = change.document;
    if(changedDocSet.has(doc.uri)){
        const fp = URI.parse(doc.uri).fsPath;
        const data = JSON.stringify({
            Id: "ChangeDocument",
            FilePaths: [fp],
            Position: 0,
            Text: doc.getText()
        });    
        changedDocSet.delete(doc.uri);
        await getComdData(data);
    }
});


connection.onCompletion(async (_textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
        // const json_data = JSON.stringify({
        //     cmd: "OK",
        //     line: 10,
        //     col:25,
        //     uri: _textDocumentPosition.textDocument.uri
        // });
        // const data = JSON.stringify({
        //     id: "text",
        //     json_string: json_data
        // });
       
    const fp = URI.parse(_textDocumentPosition.textDocument.uri).fsPath;
    const pos = documents.get(_textDocumentPosition.textDocument.uri)?.offsetAt(_textDocumentPosition.position);
    const data = JSON.stringify({
        Id: "Completion",
        FilePaths: [fp],
        Position: pos,
        Text: documents.get(_textDocumentPosition.textDocument.uri)?.getText()
    });
    let ret = await getComdData(data);
    let res_items: any[] = JSON.parse(ret).items;
    let comlItems: CompletionItem[] = res_items.map(item => {
        const val = symbolKindMap.get(item.Kind);
        const kind = val?val:CompletionItemKind.Text;
        return {
            label: item.DisplayText,
            insertText: item.CompletionText,
            kind: kind
        };
    });
    return comlItems;
    // return [
    // {
    //     label: 'TypeScript',
    //     kind: CompletionItemKind.Text,
    //     data: 1
    // },
    // {
    //     label: 'JavaScript',
    //     kind: CompletionItemKind.Text,
    //     data: 2
    // }
    // ];
});
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    // if (item.data === 1) {
    //     item.detail = 'TypeScript details';
    //     item.documentation = 'TypeScript documentation';
    // } else if (item.data === 2) {
    //     item.detail = 'JavaScript details';
    //     item.documentation = 'JavaScript documentation';
    // }
    return item;
});
// connection.onDeclaration
connection.onDefinition(async (params: DefinitionParams): Promise<Location[]> => {
    console.log(params);

    const uri = params.textDocument.uri;
    const fp = URI.parse(uri).fsPath;
    const pos = documents.get(uri)?.offsetAt(params.position);
    if(!documents.get(uri)){
        return  new Array<Location>();
    }
    const data = JSON.stringify({
        Id: "Definition",
        FilePaths: [fp],
        Position: pos,
        Text: documents.get(uri)?.getText()
    });
    let ret = await getComdData(data);
    let resItems: any[] = JSON.parse(ret).items;
    const defItems: Location[] = [];
    resItems.forEach(item => {
        const defUri = URI.file(item.FilePath).toString();
        const doc = textDocumentMap.get(defUri);
        if(doc){        
            defItems.push(Location.create(defUri, {
                start: doc.positionAt(item.Start),
                end: doc.positionAt(item.End)
            }));  
        }
    });
    return defItems;
});

connection.onHover(async (params: HoverParams): Promise<Hover | undefined> => {
    const uri = params.textDocument.uri;
    const fp = URI.parse(uri).fsPath;
    const doc = documents.get(uri);
    if(!doc){
        return undefined;
    }
    
    const pos = doc.offsetAt(params.position);
    const data = JSON.stringify({
        Id: "Hover",
        FilePaths: [fp],
        Position: pos,
        Text: documents.get(uri)?.getText()
    });
    let ret = await getComdData(data);
    let resItems: any[] = JSON.parse(ret).items;
    // const contents: string[] = resItems.map(item => {
    //     return item.DisplayText;
    // });
    if(resItems.length === 0){
        return undefined;
    }
    const item = resItems[0];
    const content: MarkupContent = {
        kind: "markdown",
        value: [
            '```vb',
            `${item.DisplayText}`,
            '```',
            '```xml',
            `${item.Description}`,
            '```',
        ].join('\n'),
    };
    return { contents: content };
    // return { contents: contents };
});
// connection.onExit(async ()=>{
//     const data = JSON.stringify({
//         Id: "Exit",
//         FilePath: "",
//         Position: 0,
//         Text: ""
//     });
//     await getComdData(data);
// });
connection.onShutdown(async ()=>{
    const data = JSON.stringify({
        Id: "Shutdown",
        FilePath: [""],
        Position: 0,
        Text: ""
    });
    await getComdData(data);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();