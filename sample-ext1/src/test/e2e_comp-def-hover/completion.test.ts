import * as assert from "assert";
import * as vscode from "vscode";
import * as helper from "../helper";

let fixtureFile : helper.FixtureFile;

function getPosition(filename: string, target: string, targetOffset: number): vscode.Position{
	const text = fixtureFile.getText(filename);
	const index = text.indexOf(target);
	const lines = text.substring(0, index + target.length).split("\r\n");
	const lineIndex = lines.length - 1;
	const chaStart = lines[lineIndex].indexOf(target);
	return new vscode.Position(lineIndex, chaStart + targetOffset);
}

suite("Extension E2E Completion Test Suite", () => {	
	suiteSetup(async () => {
		fixtureFile = new helper.FixtureFile(
			["c1.cls", "m1.bas", "m2.bas"]
		);

		const port = await helper.getServerPort();
		await helper.resetServer(port);

        await vscode.commands.executeCommand("sample-ext1.startLanguageServer");
		await helper.sleep(500);
    });
    suiteTeardown(async () => {
    });

	test("completion class", async () => {
		await helper.activateExtension();

		const docUri = helper.getDocUri("m1.bas");
		const target = "c1.";
		const targetPos = getPosition("m1.bas", target, target.length);
		await testCompletion(docUri, targetPos, {
			items: [
				{
					label: "Public Name As String",
					insertText: "Name",
					kind: vscode.CompletionItemKind.Field
				},
				{
					label: "Public Age As Long",
					insertText: "Age",
					kind: vscode.CompletionItemKind.Field
				},
				{
					label: "Public Property Prop1(index As Long) As Long",
					insertText: "Prop1",
					kind: vscode.CompletionItemKind.Property
				},
				{
					label: "Public Sub Hello(val1 As String)",
					insertText: "Hello",
					kind: vscode.CompletionItemKind.Method
				},
				{
					label: "Public Function GetHello(val As String) As String",
					insertText: "GetHello",
					kind: vscode.CompletionItemKind.Method
				}
			]
		});
	});

	test("completion module", async () => {
		await helper.activateExtension();

		const docUri = helper.getDocUri("m1.bas");
		const target = "' completion position";
		const pos = getPosition("m1.bas", target, target.length);
		const targetPos = new vscode.Position(pos.line + 1, 0);
		await testCompletion(docUri, targetPos, {
			items: [
				{
					label: "Class1",
					insertText: "Class1",
					kind: vscode.CompletionItemKind.Class
				},
				{
					label: "Private buf As String",
					insertText: "buf",
					kind: vscode.CompletionItemKind.Field
				},
				{
					label: "Public Sub Sample1()",
					insertText: "Sample1",
					kind: vscode.CompletionItemKind.Method
				},
				{
					label: "Private Function Sample2() As String",
					insertText: "Sample2",
					kind: vscode.CompletionItemKind.Method
				},
				{
					label: "Private Sub Sample3()",
					insertText: "Sample3",
					kind: vscode.CompletionItemKind.Method
				},
				{
					label: "public Sub Module2Sample1()",
					insertText: "Module2Sample1",
					kind: vscode.CompletionItemKind.Method
				},
				{
					label: "public Sub Module2Sample2()",
					insertText: "Module2Sample2",
					kind: vscode.CompletionItemKind.Method
				},
				{
					label: "Public Sub call1()",
					insertText: "call1",
					kind: vscode.CompletionItemKind.Method
				},
				{
					label: "c1",
					insertText: "c1",
					kind: vscode.CompletionItemKind.Variable
				},
			]
		});
	});
});

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletionList: vscode.CompletionList
) {
	await helper.activate(docUri);
	const actualCompletionList = (await vscode.commands.executeCommand(
		"vscode.executeCompletionItemProvider",
		docUri,
		position
	)) as vscode.CompletionList;

	const sotrFunc = (a:any, b:any): number => {
		return a.label < b.label?-1:1;
	};

	const actualCompletionItems = actualCompletionList.items.filter(x => {
		return x.kind !== vscode.CompletionItemKind.Snippet;
	}).sort(sotrFunc);
	const expectedCompletionItems = expectedCompletionList.items.sort(sotrFunc);

	assert.equal(actualCompletionItems.length, expectedCompletionItems.length);
	actualCompletionItems.forEach((expectedItem, i) => {
		const actualItem = actualCompletionItems[i];
		assert.equal(actualItem.label, expectedItem.label);
		assert.equal(actualItem.insertText, expectedItem.insertText);
		assert.equal(actualItem.kind, expectedItem.kind);
	});
}
