import promptSync from "prompt-sync";
import * as fs from "fs";
import { OPPONENT, PLAYER } from "./globals.mjs";
const prompt = promptSync();

//Func: function to be tested
//Inputs: array inputs to use while testing function
//Expected outputs: You guessed it, array of the expected outputs (second element corresponds to
//expected value when using second input. Basically, input array and expected output array
//correspond to each other).
//Max error: maximum number of errors that can be thrown from outputs that weren't expected.
export function testFunc(
  func,
  inputs,
  expectedOutputs,
  maxError = Math.pow(10, 10)
) {
  let i = 0;
  while (maxError > 0 && i < inputs.length) {
    let o = func(inputs[i]);
    if (o != expectedOutputs) {
      console.log(
        `Error arose from input ${inputs[i]}. Expected: ${expectedOutputs[i]}. Instead, got: ${o}`
      );
    }

    i += 1;
  }
}

export function playBot(board) {
  const firstLane = prompt("Index of first lane (null if nothing) ");
  if (!isNaN(parseInt(firstLane))) {
    board.setSquareOnColumn(parseInt(firstLane), OPPONENT);
  }

  while (true) {
    let bestMove = board.bestMove();
    board.setSquareOnColumn(bestMove % 7, PLAYER);
    console.log(`Best move: ${bestMove}`);

    let opponent;
    while (isNaN(opponent)) {
      let input = prompt("Opponent column:");
      if (input == null) return;
      opponent = isNaN(opponent);
    }
    board.setSquareOnColumn(opponent, OPPONENT);
  }
}

export class Log {
  //Dirname: folder where LOG.txt will live.
  //Options:
  //  - Display board path: full URL to file that will display board.
  //    Include full URL, e.g. file:///C:/Users/PROFILE/Github/Connect-4-Bot/display-board.html
  //  - Newline: Include a newline after every specific write statement
  //    Note that write will never append a newline and writeln will always append a newline
  //    regardless of what this is set to.
  constructor(dir, options) {
    this.logPath = dir + "/LOG.txt";
    this.stream = fs.createWriteStream(this.logPath, { flags: "a" });
    this.options = options;
    this.tab = false;
  }
  write(data) {
    this.stream.write(`${this.tab ? "\t" : ""}${data}`);
  }
  writeln(data) {
    this.stream.write(`${this.tab ? "\t" : ""}${data}\n`);
  }
  logBoard(board, displayBoardPath = this.options.displayBoardPath) {
    let boardStr = "";
    for (let el of board) {
      if (el == PLAYER) boardStr += "B";
      else if (el == OPPONENT) boardStr += "R";
      else boardStr += "E";
    }

    this.write(
      `${displayBoardPath}?board=${boardStr} (Opponent displayed in red)${
        this.options.newline ? "\n" : ""
      }`
    );
  }
  clearLog() {
    fs.writeFileSync(this.logPath, "");
  }
}
