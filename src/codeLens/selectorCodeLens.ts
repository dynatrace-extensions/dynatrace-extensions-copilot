import * as vscode from "vscode";
import { resolveSelectorTemplate, ValidationStatus } from "../utils/selectors";

/**
 * A Code Lens to display the status of validating a selector.
 */
class ValidationStatusLens extends vscode.CodeLens {
  selector: string;

  /**
   * @param range VSCode Range at which lens should be created
   * @param selector selector relevant to this lens
   * @param status the validation status for this lens' selector
   */
  constructor(range: vscode.Range, selector: string, status: ValidationStatus) {
    super(range);
    this.selector = selector;
    this.command = this.getStatusAsCommand(status);
  }

  /**
   * Interprets a ValidationStatus and translates it to a vscode.Command to be used
   * inside the code lens.
   * @param status status of the metric selector
   * @returns command object
   */
  private getStatusAsCommand(status: ValidationStatus): vscode.Command {
    switch (status.status) {
      case "valid":
        return {
          title: "✅",
          tooltip: "Selector is valid",
          command: "",
          arguments: [],
        };
      case "invalid":
        return {
          title: `❌ (${status.error?.code})`,
          tooltip: `Selector is invalid. ${status.error?.message}`,
          command: "",
          arguments: [],
        };
      default:
        return {
          title: "❔",
          tooltip: "Selector has not been validated yet.",
          command: "",
          arguments: [],
        };
    }
  }

  /**
   * Updates the status of this lens.
   * @param status the new status
   */
  public updateStatus(status: ValidationStatus) {
    this.command = this.getStatusAsCommand(status);
  }
}

/**
 * A Code Lens which allows validating a selector and updating its associated
 * {@link ValidationStatusLens}
 */
class SelectorValidationLens extends vscode.CodeLens {
  selector: string;

  /**
   * @param range VSCode Range at which lens should be created
   * @param selector selector relevant to this lens
   */
  constructor(range: vscode.Range, selector: string, selectorType: string) {
    super(range, {
      title: "Validate selector",
      tooltip: "Run a query and check if the selector is valid",
      command: "dt-ext-copilot.codelens.validateSelector",
      arguments: [selector, selectorType],
    });
    this.selector = selector;
  }
}

/**
 * A Code Lens which allows running a metric query with the given selector.
 */
class SelectorRunnerLens extends vscode.CodeLens {
  selector: string;

  /**
   * @param range VSCode Range at which lens should be created
   * @param selector selector relevant to this lens
   */
  constructor(range: vscode.Range, selector: string, selectorType: string) {
    super(range, {
      title: "Query data",
      tooltip: "Run the query and visualize its results",
      command: "dt-ext-copilot.codelens.runSelector",
      arguments: [selector, selectorType],
    });
    this.selector = selector;
  }
}

/**
 * Implementation of a Code Lens Provider to facilitate operations done on metric and entities
 * as well as their respective selectors.
 */
export class SelectorCodeLensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[];
  private regex: RegExp;
  private numLines: number;
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
  private readonly controlSetting: string;
  private readonly matchString: string;
  private readonly selectorType: string;

  /**
   * @param match the text to match and extract the selector by
   * @param controlSetting the vscode setting which controls this feature
   */
  constructor(match: string, controlSetting: string) {
    this.numLines = -1;
    this.codeLenses = [];
    this.matchString = match;
    this.controlSetting = controlSetting;
    this.selectorType = match.startsWith("metricSelector") ? "metric" : "entity";
    this.regex = new RegExp(`(${match})`, "g");
  }

  /**
   * Provides the actual code lenses relevant to each valid section of the extension yaml.
   * @param document VSCode Text Document - this should be the extension.yaml
   * @param token Cancellation Token
   * @returns list of code lenses
   */
  public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
    const regex = new RegExp(this.regex);
    const text = document.getText();
    const numLines = document.lineCount;

    // Honor the user's settings
    if (!vscode.workspace.getConfiguration("dynatrace", null).get(this.controlSetting) as boolean) {
      return [];
    }

    // If new lines have been entered/deleted, reset the previous lenses
    // so we don't create inaccurate duplicates
    if (numLines !== this.numLines) {
      this.numLines = numLines;
      this.codeLenses = [];
    }

    let matches;
    while ((matches = regex.exec(text)) !== null) {
      const line = document.lineAt(document.positionAt(matches.index).line);
      const indexOf = line.text.indexOf(matches[0]);
      const position = new vscode.Position(line.lineNumber, indexOf);
      const range = document.getWordRangeAtPosition(position, new RegExp(this.regex));

      if (range) {
        var selector = line.text.split(`${this.matchString} `)[1];
        if (selector.includes("$(entityConditions)")) {
          selector = resolveSelectorTemplate(selector, document, position);
        }

        this.createOrUpdateLens(new SelectorRunnerLens(range, selector, this.selectorType));
        this.createOrUpdateLens(new SelectorValidationLens(range, selector, this.selectorType));
        this.createOrUpdateLens(new ValidationStatusLens(range, selector, { status: "unknown" }));
      }
    }
    return this.codeLenses;
  }

  /**
   * Checks the knwown Code Lenses and either creates the provided lens or updates the existing
   * entry in case the details match.
   * @param newLens a Selector code lens
   */
  private createOrUpdateLens(newLens: SelectorRunnerLens | SelectorValidationLens | ValidationStatusLens) {
    let prevLensIdx = this.codeLenses.findIndex(
      (lens) => lens.constructor === newLens.constructor && lens.range.isEqual(newLens.range)
    );
    if (prevLensIdx === -1) {
      this.codeLenses.push(newLens);
    } else {
      if (
        (this.codeLenses[prevLensIdx] as SelectorRunnerLens | SelectorValidationLens | ValidationStatusLens)
          .selector !== newLens.selector
      ) {
        this.codeLenses[prevLensIdx] = newLens;
      }
    }
  }

  /**
   * Allows updating already existing Validation Status code lens. This allows on-demand
   * status updates for metric and entity selectors.
   * @param selector metric selector of the lens
   * @param status status object to update lens with
   */
  public updateValidationStatus(selector: string, status: ValidationStatus) {
    this.codeLenses
      .filter((lens) => lens instanceof ValidationStatusLens && lens.selector === selector)
      .forEach((lens) => {
        (lens as ValidationStatusLens).updateStatus(status);
      });
    this._onDidChangeCodeLenses.fire();
  }
}
