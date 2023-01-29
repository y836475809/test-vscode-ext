﻿using ConsoleApp1;
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;

namespace ConsoleAppServer
{
    public class Server
    {
        public event EventHandler<DocumentAddedEventArgs> DocumentAdded;
        public event EventHandler<DocumentDeletedEventArgs> DocumentDeleted;
        public event EventHandler<DocumentRenamedEventArgs> DocumentRenamed;
        public event EventHandler<DocumentChangedEventArgs> DocumentChanged;
        public event EventHandler<CompletionEventArgs> CompletionReq;
        public event EventHandler<DefinitionEventArgs> DefinitionReq;
        public event EventHandler<CompletionEventArgs> HoverReq;
        public event EventHandler<EventArgs> ResetReq;
        public event EventHandler<DebugEventArgs> DebugGetDocumentsEvent;
        private HttpListener listener;

        public void Setup(int port)
        {
            listener = new HttpListener();

            // リスナー設定
            listener.Prefixes.Clear();
            listener.Prefixes.Add(@$"http://localhost:{port}/");
            listener.Start();
        }

        public void Run()
        {
            bool ignoreShutdown = false;
            bool run = true;
            while (run)
            {
                // リクエスト取得
                var context = listener.GetContext();
                var request = context.Request;
                Command cmd;
                using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                {
                    var json_str = reader.ReadToEnd();
                    cmd = JsonSerializer.Deserialize<Command>(json_str);
                    //Console.WriteLine(json_str);
                }

                // レスポンス取得
                var response = context.Response;
                switch (cmd?.Id)
                {
                    case "AddDocuments":
                        var args_add = new DocumentAddedEventArgs(cmd.FilePaths);
                        DocumentAdded?.Invoke(this, args_add);
                        Response(response, 202);
                        break;
                    case "DeleteDocuments":
                        var args_del = new DocumentDeletedEventArgs(cmd.FilePaths);
                        DocumentDeleted?.Invoke(this, args_del);
                        Response(response, 202);
                        break;
                    case "RenameDocument":
                        var args_rename = new DocumentRenamedEventArgs(cmd.FilePaths[0], cmd.FilePaths[1]);
                        DocumentRenamed?.Invoke(this, args_rename);
                        Response(response, 202);
                        break;
                    case "ChangeDocument":
                        DocumentChanged?.Invoke(this, new DocumentChangedEventArgs(cmd.FilePaths[0], cmd.Text));
                        Response(response, 202);
                        break;
                    case "Completion":
                        var args = new CompletionEventArgs(cmd.FilePaths[0], cmd.Text, cmd.Position);
                        CompletionReq?.Invoke(this, args);
                        Response(response, args.Items);
                        break;
                    case "Definition":
                        var args_def = new DefinitionEventArgs(cmd.FilePaths[0], cmd.Text, cmd.Position);
                        DefinitionReq?.Invoke(this, args_def);
                        Response(response, args_def.Items);
                        break;
                    case "Hover":
                        var args_hover = new CompletionEventArgs(cmd.FilePaths[0], cmd.Text, cmd.Position);
                        HoverReq?.Invoke(this, args_hover);
                        Response(response, args_hover.Items);
                        break;
                    //case "Exit":
                    case "Shutdown":
                        if (!ignoreShutdown) {
                            run = false;
                        }
                        break;
                    case "Reset":
                        ResetReq?.Invoke(this, new EventArgs());
                        Response(response, 202);
                        break;
                    case "IgnoreShutdown":
                        ignoreShutdown = true;
                        Response(response, 202);
                        break;
                    case "Debug:GetDocuments":
                        var args_debug = new DebugEventArgs();
                        string debugInfo = string.Empty;
                        DebugGetDocumentsEvent?.Invoke(this, args_debug);
                        Response(response, args_debug.Text);
                        break;
                }
                if (run) {
                    response.Close();
                }


                //// HTMLを表示する
                //if (request != null)
                //{
                //    var res_com = new ResponseCompletion();
                //    res_com.items = new List<string>() { "aaa", "bbb" };
                //    var text = Encoding.UTF8.GetBytes(JsonSerializer.Serialize<ResponseCompletion>(res_com));
                //    response.ContentType = "application/json";
                //    response.ContentLength64 = text.Length;
                //    response.OutputStream.Write(text, 0, text.Length);
                //}
                //else
                //{
                //    response.StatusCode = 404;
                //}
                //response.Close();
            }

        }

        private void Response(HttpListenerResponse response, int StatusCode) {
            response.StatusCode = StatusCode;
            //response.Close();
        }
        //private void Response(HttpListenerResponse response, AddDocumentItem Item) {
        //    var text = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(Item));
        //    response.ContentType = "application/json";
        //    response.ContentLength64 = text.Length;
        //    response.OutputStream.Write(text, 0, text.Length);
        //}

        private void Response(HttpListenerResponse response, string text) {
            var data = Encoding.UTF8.GetBytes(text);
            response.ContentType = "application/json";
            response.ContentLength64 = data.Length;
            response.OutputStream.Write(data, 0, data.Length);
        }

        private void Response(HttpListenerResponse response, List<CompletionItem> CompletionItems)
        {
            var text = Encoding.UTF8.GetBytes(JsonSerializer.Serialize<List<CompletionItem>>(CompletionItems));
            response.ContentType = "application/json";
            response.ContentLength64 = text.Length;
            response.OutputStream.Write(text, 0, text.Length);
            //response.Close();
        }

        private void Response(HttpListenerResponse response, List<DefinitionItem> Items) {
            //res_def.Start = Start;
            //res_def.End = End;
            var text = Encoding.UTF8.GetBytes(
                JsonSerializer.Serialize<List<DefinitionItem>>(Items));
            response.ContentType = "application/json";
            response.ContentLength64 = text.Length;
            response.OutputStream.Write(text, 0, text.Length);
            //response.Close();
        }
    }
}
