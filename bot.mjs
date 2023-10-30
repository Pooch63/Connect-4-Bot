import * as debug from "./debug.mjs";

import {
  WIDTH,
  HEIGHT,
  WINNING_LENGTH,
  EMPTY,
  PLAYER,
  OPPONENT,
} from "./globals.mjs";

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
        if (checkForConsecutives(row_)) lanes[x + y] = 1;
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

        if (square == EMPTY && consecutive >= WINNING_LENGTH - 1) {
          lanes[index] = 1;
        }

        if (square != type) consecutive = 0;
      }
    }
    //Add diagonals
    for (let index of this.diagonalCheckStarts) {
      let lineLength = WIDTH - (index % WIDTH);

      //We store mirrored vars because we're checking for left-to-right
      //diagonals on both the board and the mirrored version of the board.

      //Number of pieces in a row we've found.
      let consecutive = 0;
      let mirrorConsecutive = 0;

      //Store the last empty square we found, so that if we find that there
      //is an empty square between three of our pieces, we mark it as a lane.
      let lastEmpty = null;
      let lastMirrorEmpty = null;

      let updatedLastEmpty = false;
      let updatedLastMirrorEmpty = false;

      for (let i = 0; i < lineLength; i += 1) {
        let square = this.board[index];
        let mirrorSquare = this.mirroredBoard[index];

        if (square == OPPOSING) {
          consecutive = 0;
          updatedLastEmpty = false;
        }
        if (square == type) consecutive += 1;

        if (square == EMPTY) {
          if (consecutive >= WINNING_LENGTH - 1) {
            lanes[index] = 1;
            updatedLastEmpty = false;
            consecutive = 0;
          }

          lastEmpty = index;
          if (updatedLastEmpty) consecutive = 0;
          if (consecutive > 0) updatedLastEmpty = true;
        }
        if (consecutive >= WINNING_LENGTH) updatedLastEmpty = false;
        if (consecutive >= WINNING_LENGTH - 1) {
          if (square == type && lastEmpty != null) lanes[lastEmpty] = 1;

          if (updatedLastEmpty) consecutive = 0;
          updatedLastEmpty = false;
        }

        if (mirrorSquare == OPPOSING) {
          mirrorConsecutive = 0;
          updatedLastMirrorEmpty = false;
        }
        if (mirrorSquare == type) mirrorConsecutive += 1;

        if (mirrorSquare == EMPTY) {
          if (mirrorConsecutive >= WINNING_LENGTH - 1) {
            lanes[Board.mirrorIndex(index)] = 1;
            updatedLastMirrorEmpty = false;
            mirrorConsecutive = 0;
          }

          lastMirrorEmpty = index;
          if (updatedLastMirrorEmpty) mirrorConsecutive = 0;
          if (mirrorConsecutive > 0) updatedLastMirrorEmpty = true;
        }
        if (mirrorConsecutive >= WINNING_LENGTH) updatedLastMirrorEmpty = false;
        if (mirrorConsecutive >= WINNING_LENGTH - 1) {
          if (mirrorSquare == type && lastEmpty != null) {
            lanes[Board.mirrorIndex(lastMirrorEmpty)] = 1;
          }

          if (updatedLastMirrorEmpty) mirrorConsecutive = 0;
          updatedLastMirrorEmpty = false;
        }

        index = index + WIDTH + 1;
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
      console.log(this.opponentLanes);
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
      if (floor < HEIGHT - 1) indices.push(floor * WIDTH + i);
    }

    return indices;
  }

  //Accepts the player whose turn it is to move (PLAYER or OPPONENT)
  evalPos(type) {
    if (this.playerWon) return Number.POSITIVE_INFINITY;
    if (this.opponentWon) return Number.NEGATIVE_INFINITY;

    let indices = this.getPlayableIndices();
    let player = type == PLAYER;
    let lanes = player ? this.lanes : this.opponentLanes;

    //Check if we have an immediate win.
    let win = this.playableLane(indices, lanes);
    if (win != null) {
      return player ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }

    return 0;
  }

  //Player: Is it the player's turn, or the opponent's turn?
  minimax(depth, player) {
    //If a player won, we might have some moves, but it's already over
    if (this.playerWon) return Number.POSITIVE_INFINITY;
    if (this.opponentWon) return Number.NEGATIVE_INFINITY;

    if (depth <= 1) return this.evalPos();

    let indices = this.getPlayableIndices();

    //No moves, it's a draw!
    if (indices.length == 0) return 0;

    let bestScore = player
      ? Number.NEGATIVE_INFINITY
      : Number.POSITIVE_INFINITY;

    let squareType = player ? PLAYER : OPPONENT;

    if (player) {
      for (let index of indices) {
        console.log(`Player index: ${index}`);
        this.savePosToHistory();
        this.setSquare(index, squareType, true);
        let score = this.minimax(depth - 1, !player);
        if (score > bestScore) bestScore = score;
        console.log(`Our score: ${score}`);

        this.goToLastPos();
      }
    }
    if (!player) {
      for (let index of indices) {
        console.log(`Opponent index: ${index}`);

        this.savePosToHistory();
        this.setSquare(index, squareType, true);
        let score = this.minimax(depth - 1, !player);
        if (score < bestScore) bestScore = score;
        this.goToLastPos();
      }
    }
    return bestScore;
  }

  //Returns 0 - WIDTH, basically column where we want to play
  bestMove() {
    let indices = this.getPlayableIndices();
    console.log(indices, this.floors);

    let bestMove = indices[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index of indices) {
      this.savePosToHistory();
      this.setSquare(index, PLAYER, true);
      let score = this.minimax(3, true);
      if (score > bestScore) bestMove = index;
      console.log(`Score: ${score}`);
      this.goToLastPos();
    }
    return bestMove;
  }

  //Debug purposes. Player moves and opponent arrays are integer arrays of columns to played.
  //Makes the player's column move, then opponent's, then player, etc. -1 means don't make a move
  //for that particular side that turn.  By default, subtracts one from the columns.
  setBoard(playerMoves, opponentMoves, subtract = true) {
    for (let i = 0; i < playerMoves.length; i += 1) {
      let p = playerMoves[i] - (subtract ? 1 : 0),
        o = opponentMoves[i] - (subtract ? 1 : 0);
      if (!isNaN(p) && p >= 0) {
        this.setSquareFromPos(p, this.floors[p], PLAYER);
      }
      if (!isNaN(o) && o >= 0) {
        this.setSquareFromPos(o, this.floors[o], OPPONENT);
      }
    }
  }
}

const timeFunc = (c, f) => {
  console.time();
  for (let i = 0; i < c; i += 1) f();
  console.timeEnd();
};

let b = new Board();

function debugSetStartingPos() {
  // b.setBoard(
  //   [5, 3, 5, 5, 4, 4, 3, 7, 7, 7, 1, 1, 1, 4, 5],
  //   [4, 4, 5, 3, 3, 3, 4, 7, 7, 7, 1, 1, 1, 3, 5]
  // );
  b.setSquareFromPos(2, 0, PLAYER);
  b.setSquareFromPos(4, 0, PLAYER);
  b.setSquareFromPos(5, 0, PLAYER);
  console.log("CALCULATING");
  console.log(b.calcLanes(PLAYER));
}
debugSetStartingPos();

// console.log("Best move", b.bestMove());
// console.log(b.board);

// console.log(b.evalPos(PLAYER));
// timeFunc(1_000, () => b.calcLanes(PLAYER));
