import * as vscode from "vscode";
import { exec } from "child_process";

const ignoreProperties = 'Select-Object -Property * -ExcludeProperty @("Scope", "Path", "Options", "Properties", "SystemProperties", "ClassPath", "Qualifiers", "Site", "Container", "PSComputerName", "__GENUS", "__CLASS", "__SUPERCLASS", "__DYNASTY", "__RELPATH", "__PROPERTY_COUNT", "__DERIVATION", "__SERVER", "__NAMESPACE", "__PATH")';

export interface WmiQueryResult {
  query: string;
  responseTime: string;
  error: boolean;
  errorMessage?: string;
  results: Array<Record<string, string | number>>;
}

export async function runWMIQuery(query: string, oc: vscode.OutputChannel, callback: (query: string, result: WmiQueryResult) => void) {
  const command = `Get-WmiObject -Query "${query}" | ${ignoreProperties} | ConvertTo-Json`;
  const startTime = new Date();
  console.log(`Running command: ${command}`);

  exec(command, { shell: "powershell.exe", maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      oc.clear();
      oc.appendLine(error.message);
      oc.show();
      const responseTime = ((new Date().getTime() - startTime.getTime()) / 1000).toString();
      
      callback(query, { query, error: true, errorMessage: error.message, results: [], responseTime });
      return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        oc.clear();
        oc.appendLine(stderr);
        oc.show();
        const responseTime = ((new Date().getTime() - startTime.getTime()) / 1000).toString();
        callback(query, { query, error: true, errorMessage: stderr, results: [], responseTime });
        return;
        }
    
    const jsonResponse = JSON.parse(stdout);
    
    const responseTime = ((new Date().getTime() - startTime.getTime()) / 1000).toString();
    callback(query, {
      query,
      error: false,
      results: jsonResponse,
      responseTime
    });
    oc.clear();
  });
}
