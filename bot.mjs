import * as debug from "./debug.mjs";

import {
  WIDTH,
  HEIGHT,
  WINNING_LENGTH,
  EMPTY,
  PLAYER,
  OPPONENT,
} from "./globals.mjs";

const { min, max } = Math;

//Clones object. Assumes values are primitives
function cloneObject(obj_) {
  let obj = {};
  for (let key in obj_) obj[key] = obj_[key];
  return obj;
}
//Clones 1D array of primitives
function clone1DArray(arr_) {
  let arr = [];
  for (let el of arr_) arr.push(el);
  return arr;
}

//How many properties are in an object?
function countProperties(obj) {
  let count = 0;

  for (let prop in obj) {
    if (obj.hasOwnProperty(prop)) count++;
  }
  return count;
}

//Please note: This table is one part of the evaluation function
//I saw it on: https://softwareengineering.stackexchange.com/questions/263514/why-does-this-evaluation-function-work-in-a-connect-four-game-in-java
//prettier-ignore
const evalTable = [
  3, 4, 5, 7, 5, 4, 3,
  4, 6, 8, 10, 8, 6, 4,
  5, 8, 11, 13, 11, 8, 5,
  5, 8, 11, 13, 11, 8, 5,
  4, 6, 8, 10, 8, 6, 4,
  3, 4, 5, 7, 5, 4, 3,
];

class Board {
  //Given an index on the board, return the index of that spot reflected across
  //the vertical middle of the board. E.G., if passed the index of (2, 5) on a 6 x 7 board,
  //returns (4, 5).
  static mirrorIndex(index) {
    let mod = index % WIDTH;
    return index - mod + (WIDTH - 1 - mod);
  }
  constructor() {
    /* Format of board store type:
         0: Bottom left corner of board (0, 0)
         1: Square next to bottom left corner (1, 0)
         And etc.
         In a 7 x 6 board, the top right corner would be at (6, 5) and at index 41 (AKA 6 + 5 * WIDTH)
    */
    this.board = [];
    //Mirrored board is, as you can guess, a board mirrored across the middle,
    //so a square on (1, 0) on the normal 7 x 6 board would be represented as
    //on square (5, 0). Used in optimizing diagonal win checks, so we run a left-to-right
    //diagonal win test on the board AND the mirrored board, instead of a left-to-right AND
    //and right-to-left test on the board.
    this.mirroredBoard = [];
    for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
      this.board.push(EMPTY);
      this.mirroredBoard.push(EMPTY);
    }

    //If we get our piece on these board indices, we win
    //The indices are the keys
    this.lanes = {};
    //If the opponent gets their piece on these board indices, they win
    //The indices are the keys
    this.opponentLanes = {};

    //Highest square on each column (stores the y-index)
    this.floors = [];
    for (let i = 0; i < WIDTH; i += 1) this.floors.push(0);

    //Precalculate all the positions on the board from which to check for
    //left-to-right diagonal wins.
    this.diagonalCheckStarts = [];
    if (WIDTH >= WINNING_LENGTH) {
      //Left perim
      for (let y = HEIGHT - WINNING_LENGTH; y >= 0; y -= 1) {
        this.diagonalCheckStarts.push(0 + y * WIDTH);
      }
      //Bottom border
      for (let x = WIDTH - WINNING_LENGTH; x > 0; x -= 1) {
        this.diagonalCheckStarts.push(x);
      }
    }

    this.history = [];

    this.playerWon = false;
    this.opponentWon = false;
  }
  savePosToHistory() {
    this.history.push({
      board: clone1DArray(this.board),
      mirroredBoard: clone1DArray(this.mirroredBoard),
      floors: clone1DArray(this.floors),
      lanes: cloneObject(this.lanes),
      opponentLanes: cloneObject(this.opponentLanes),
      playerWon: this.playerWon,
      opponentWon: this.opponentWon,
    });
  }
  //Reverts to last position in history
  goToLastPos() {
    let last = this.history.pop();
    this.board = last.board;
    this.mirroredBoard = last.mirroredBoard;
    this.floors = last.floors;
    this.lanes = last.lanes;
    this.opponentLanes = last.opponentLanes;
    this.playerWon = last.playerWon;
    this.opponentWon = last.opponentWon;
  }

  getSquare(x, y) {
    return this.board[x + y * WIDTH];
  }
  //If a player won when this is called and updateWinner = true, we update that
  //player's win status in the board object.
  calcLanes(type) {
    let lanes = {};
    const OPPOSING = type == PLAYER ? OPPONENT : PLAYER;

    const checkForConsecutives = (row) => {
      let consecutive = 0;
      for (let square of row) {
        if (square == type) consecutive += 1;
        else consecutive = 0;

        if (consecutive >= WINNING_LENGTH) return true;
      }
    };

    for (let row = 0; row < HEIGHT; row += 1) {
      //Number of pieces in a row we've found
      let y = row * WIDTH;

      for (let x = 0; x < WIDTH; x += 1) {
        let square = this.board[x + y];
        if (square != EMPTY) continue;

        let row_ = this.board.slice(y, y + WIDTH);
        row_[x] = type;
        if (checkForConsecutives(row_) && this.board[x + y] == EMPTY) {
          lanes[x + y] = 1;
        }
      }
    }

    //Add columns
    for (let column = 0; column < WIDTH; column += 1) {
      //Number of pieces in a row we've found
      let consecutive = 0;

      for (let y = 0; y < HEIGHT; y += 1) {
        let index = column + y * WIDTH;
        let square = this.board[index];
        if (square == type) consecutive += 1;

        if (
          square == EMPTY &&
          consecutive >= WINNING_LENGTH - 1 &&
          this.board[index] == EMPTY
        ) {
          lanes[index] = 1;
        }

        if (square != type) consecutive = 0;
      }
    }
    //Add diagonals
    for (let index of this.diagonalCheckStarts) {
      let lineLength = WIDTH - (index % WIDTH);

      //Set array that will store the pieces in the left-to-right diagonal on the board
      //and the left-to-right diagonal on the mirrored board.
      let diagonal = [],
        mirrorDiagonal = [];

      let currentIndex = index;
      while (lineLength-- > 0) {
        diagonal.push(this.board[currentIndex]);
        mirrorDiagonal.push(this.mirroredBoard[currentIndex]);
        currentIndex = currentIndex + WIDTH + 1;
      }

      for (let i = 0; i < diagonal.length; i += 1) {
        if (diagonal[i] == EMPTY) {
          let diagonalCopy = diagonal.slice(0);
          diagonalCopy[i] = type;
          let ind = index + (WIDTH + 1) * i;
          if (checkForConsecutives(diagonalCopy) && this.board[ind] == EMPTY) {
            lanes[ind] = 1;
          }
        }
        if (mirrorDiagonal[i] == EMPTY) {
          let mirrorDiagonalCopy = mirrorDiagonal.slice(0);
          mirrorDiagonalCopy[i] = type;
          let ind = Board.mirrorIndex(index) + (WIDTH - 1) * i;
          if (
            checkForConsecutives(mirrorDiagonalCopy) &&
            this.board[ind] == EMPTY
          ) {
            lanes[ind] = 1;
          }
        }
      }
    }

    return lanes;
  }
  setSquare(index, type, calcLanes = true, x = index % WIDTH) {
    this.board[index] = type;

    //Update the mirrored version of the board as well.
    this.mirroredBoard[Board.mirrorIndex(index)] = type;

    this.floors[x] += 1;

    if (!calcLanes) return;

    if (type == PLAYER) {
      //Did player win?
      if (this.lanes[index] == 1) {
        this.playerWon = true;
        return;
      }

      this.lanes = this.calcLanes(PLAYER);
      //Remove opponent's lane if we took it
      if (this.opponentLanes[index] == 1) {
        this.opponentLanes[index] = 0;
      }
    } else {
      //Did opponent win?
      if (this.opponentLanes[index] == 1) {
        this.opponentWon = true;
        return;
      }

      this.opponentLanes = this.calcLanes(OPPONENT);
      //Opponent took our lane, remove it
      if (this.lanes[index] == 1) this.lanes[index] = 0;
    }
  }
  setSquareFromPos(x, y, type, calcLanes = true) {
    return this.setSquare(x + y * WIDTH, type, calcLanes, x);
  }

  //Out of a bunch of different lanes, return the index of a play that wins
  //Null if no win
  //Accepts a list of indices where a piece can be played
  playableLane(avail, lanes) {
    //Check if we have an immediate win.
    for (let index of avail) if (lanes[index] == 1) return index;
  }

  getPlayableColumns() {
    let avail = [];
    for (let i = 0; i < this.floors.length; i += 1) {
      if (this.floors[i] != HEIGHT - 1) avail.push(i);
    }

    return avail;
  }
  getPlayableIndices() {
    let indices = [];
    for (let i = 0; i < this.floors.length; i += 1) {
      let floor = this.floors[i];
      if (floor <= HEIGHT - 1) indices.push(floor * WIDTH + i);
    }

    return indices;
  }

  //Accepts the player whose turn it is to move (PLAYER or OPPONENT)
  evalPos(type, originalDepth) {
    if (this.playerWon) return 100_000_000 - originalDepth;
    if (this.opponentWon) return -100_000_000 + originalDepth;

    let indices = this.getPlayableIndices();
    let player = type == PLAYER;
    let lanes = player ? this.lanes : this.opponentLanes;

    //Check if we have an immediate win.
    let win = this.playableLane(indices, lanes);
    if (win != null) {
      if (player) return 100_000_000 - originalDepth;
      else return -100_000_000 + originalDepth;
    }

    let score = 0;
    let lc = countProperties(this.lanes),
      olc = countProperties(this.opponentLanes);

    score = score + lc * 1.2;
    score = score - olc * 1.2;

    for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
      if (this.board[i] == PLAYER) score += evalTable[i];
      else if (this.board[i] == OPPONENT) score -= evalTable[i];
    }

    return score;
  }

  //Depth: Current depth
  //Player: Is it the player's turn, or the opponent's turn?
  //Original depth: Obviously the original depth
  //Alpha and beta: look up minimax algorithm
  //Start time: time in milliseconds that the search started
  //Max time: max time in milliseconds that the search may last for
  minimax(depth, player, originalDepth, alpha, beta, startTime, maxTime) {
    if (Date.now() - startTime >= maxTime) return;

    //If a player won, we might have some moves, but it's already over
    if (this.playerWon) return 100_000_000 - originalDepth;
    if (this.opponentWon) return -100_000_000 + originalDepth;

    if (depth <= 1) {
      return this.evalPos(player ? PLAYER : OPPONENT, originalDepth);
    }
    let indices = this.getPlayableIndices();

    //No moves, it's a draw!
    if (indices.length == 0) return 0;

    let bestScore = player
      ? Number.NEGATIVE_INFINITY
      : Number.POSITIVE_INFINITY;

    let squareType = player ? PLAYER : OPPONENT;

    if (player) {
      for (let index of indices) {
        this.savePosToHistory();
        this.setSquare(index, squareType, true);

        if (Date.now() - startTime >= maxTime) {
          this.goToLastPos();
          return bestScore;
        }

        let score = this.minimax(
          depth - 1,
          !player,
          originalDepth,
          alpha,
          beta
        );
        this.goToLastPos();

        if (Date.now() - startTime >= maxTime) return bestScore;

        if (score > bestScore) bestScore = score;
        alpha = max(score, alpha);
        if (beta <= alpha) break;
      }
    }
    if (!player) {
      for (let index of indices) {
        this.savePosToHistory();
        this.setSquare(index, squareType, true);

        if (Date.now() - startTime >= maxTime) {
          this.goToLastPos();
          return bestScore;
        }

        let score = this.minimax(
          depth - 1,
          !player,
          originalDepth,
          alpha,
          beta
        );
        this.goToLastPos();

        if (Date.now() - startTime >= maxTime) return bestScore;

        if (score < bestScore) bestScore = score;
        beta = min(score, beta);
        if (beta <= alpha) break;
      }
    }
    return bestScore;
  }

  //Returns 0 - WIDTH, basically column where we want to play
  bestMoveDebug(depth = 6) {
    let indices = this.getPlayableIndices();

    log.writeln(`Current position: `);
    log.logBoard(this.board);

    let bestMove = indices[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index of indices) {
      log.tab = false;
      log.writeln(`Testing move`);
      log.tab = true;
      log.writeln(`Index: ${index}`);
      log.writeln(
        `Pos: (${index % WIDTH}, ${(index - (index % WIDTH)) / WIDTH})`
      );
      log.writeln(`Searching at a depth of: ${depth}`);
      this.savePosToHistory();
      this.setSquare(index, PLAYER, true);
      let score = this.minimax(
        depth - 1,
        false,
        depth,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY
      );
      log.writeln(`Board after playing move: `);
      log.logBoard(b.board);
      log.writeln(
        `Position was assigned a score of: ${score}. Current best score: ${bestScore}`
      );
      if (score > bestScore) {
        bestScore = score;
        bestMove = index;
      }
      this.goToLastPos();
    }

    log.tab = false;
    log.writeln(
      `Best move at index ${bestMove}. Pos: (${bestMove % WIDTH}, ${
        (bestMove - (bestMove % WIDTH)) / WIDTH
      })`
    );

    return bestMove;
  }
  bestMove(time = 1_000, maxDepth = 20) {
    let indices = this.getPlayableIndices();

    let bestMove = indices[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    let start = Date.now();

    for (let x = 1; x <= maxDepth; x += 1) {
      console.log(x);
      for (let index of indices) {
        this.savePosToHistory();
        this.setSquare(index, PLAYER, true);

        if (Date.now() - start >= time) {
          this.goToLastPos();
          return bestMove;
        }

        let score = this.minimax(
          x,
          false,
          x,
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          start,
          time
        );
        this.goToLastPos();

        if (Date.now() - start >= time) return bestMove;
        if (score > bestScore) {
          bestScore = score;
          bestMove = index;
        }
      }
    }
    return bestMove;
  }

  //Debug purposes. Player moves and opponent arrays are integer arrays of columns to played.
  //Makes the player's column move, then opponent's, then player, etc. -1 means don't make a move
  //for that particular side that turn.  By default, subtracts one from the columns.
  //E.G., if you pass 7 as a column and don't set subtract to true, the column at index 7 doesn't exist,
  //so behavior is undefined. If your column range IS 1-7 and NOT 0-6, set subtract to true.
  setBoardByMoves(playerMoves, opponentMoves, subtract = true) {
    for (
      let i = 0;
      i < Math.max(playerMoves.length, opponentMoves.length);
      i += 1
    ) {
      let p = playerMoves[i] - (subtract ? 1 : 0),
        o = opponentMoves[i] - (subtract ? 1 : 0);
      if (!isNaN(p) && p >= 0) {
        this.setSquareOnColumn(p, PLAYER);
      }
      if (!isNaN(o) && o >= 0) {
        this.setSquareOnColumn(o, OPPONENT);
      }
    }
  }
  //Debug purposes. Slide a piece in at a certain column, on top of that column's floor
  setSquareOnColumn(column, player) {
    this.setSquareFromPos(column, this.floors[column], player);
  }
  //Debug purposes. Given board array, update this board array,
  //floors, game history, etc.
  setBoardByArray(board) {
    for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
      let p = board[i];
      if (p != EMPTY) this.setSquareOnColumn(i % WIDTH, p);
    }
  }
  //Debug purposes. Given board str, e.g. BBRRRBBEBRRRBEEERREEEEEBBEEEEEEEEEEEEEEEEE,
  //set board such that the first character (B) is at index 0 of the board array and
  //the last (E) is at index 41. B means PLAYER, R means OPPONENT, and E means EMPTY.
  //String may be less than 42 characters. Any spots not provided are presumed to be empty.
  setBoardByBoardStr(str) {
    let board = [];
    let i = WIDTH * HEIGHT;
    while (i-- > 0) board.push(EMPTY);

    str = str.toUpperCase();

    let c = -1;
    while (++c < str.length) {
      let p = str[c];
      if (p == "B") board[c] = PLAYER;
      if (p == "R") board[c] = OPPONENT;
    }

    this.setBoardByArray(board);
  }
}

const timeFunc = (c, f) => {
  console.time();
  for (let i = 0; i < c; i += 1) f();
  console.timeEnd();
};

let b = new Board();

function debugSetStartingPos() {
  console.log("CALCULATING");
  console.log(b.calcLanes(OPPONENT));
}
debugSetStartingPos();

const log = new debug.Log("./", {
  displayBoardPath:
    "file:///C:/Users/kiyaa/Project/Github/Connect-4-Bot/Web/board.html",
  newline: true,
});
log.clearLog();
log.write("new stuff!");

//prettier-ignore
// b.setBoardByMoves(
//   [-1, 3, 4, 7, 5, 3, 3, 4, 5, 7,],
//   [4, 5, 6, 5, 4, 3, 6, 7, 7, 4,],
// true);
console.time();
console.log(b.bestMove(10_000));
console.timeEnd();
// debug.playBot(Board, log);

console.time();
for (let i = 0; i < 1_000; i += 1) {
  let z = b.evalPos(PLAYER);
}
console.timeEnd();
