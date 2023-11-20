import * as debug from "./debug.mjs";

import { WIDTH, HEIGHT, WINNING_LENGTH, EMPTY, BLUE, RED } from "./globals.mjs";

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

const MAX_CACHE_SIZE = 10_000;

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
    this.blueLanes = {};
    //If the opponent gets their piece on these board indices, they win
    //The indices are the keys
    this.redLanes = {};

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

    this.blueWon = false;
    this.redWon = false;

    /*Cache of different positions and their evaluations.
    Example entry:
    "1,2,1,1,1,2,1,0,2,1,2,1,0,0,0,0,2,1,2,0,0,0,0,1,2,2,0,0,0,0,0,1,0,0,0,0,0,0,2,0,0,0-B": {
      //This is the depth at which we evaluated the position
      depth: 5,
      eval: -99999995
    }*/
    this.cache = {};
  }
  savePosToHistory() {
    this.history.push({
      board: clone1DArray(this.board),
      mirroredBoard: clone1DArray(this.mirroredBoard),
      floors: clone1DArray(this.floors),
      redLanes: cloneObject(this.redLanes),
      blueLanes: cloneObject(this.blueLanes),
      blueWon: this.blueWon,
      redWon: this.redWon,
    });
  }
  //Reverts to last position in history
  goToLastPos() {
    let last = this.history.pop();
    this.board = last.board;
    this.mirroredBoard = last.mirroredBoard;
    this.floors = last.floors;
    this.redLanes = last.redLanes;
    this.blueLanes = last.blueLanes;
    this.blueWon = last.blueWon;
    this.redWon = last.redWon;
  }

  getSquare(x, y) {
    return this.board[x + y * WIDTH];
  }
  //A "lane" is an index that, if red or blue sets their piece in, they will win.
  //Calculate the red and blue lanes.
  //If red won when this is called and updateWinner = true, we update that
  //red's win status in the board object.
  calcLanes(type) {
    let lanes = {};

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

    if (type == BLUE) {
      //Did blue win?
      if (this.blueLanes[index] == 1) {
        this.blueWon = true;
        return;
      }

      this.blueLanes = this.calcLanes(BLUE);
      //Remove red's lane if blue took it
      if (this.redLanes[index] == 1) this.redLanes[index] = 0;
    } else {
      //Did red win?
      if (this.redLanes[index] == 1) {
        this.redWon = true;
        return;
      }

      this.redLanes = this.calcLanes(RED);
      //Remove blue's lane if red took it
      if (this.blueLanes[index] == 1) this.blueLanes[index] = 0;
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

  //Accepts the player whose turn it is to move (red or blue)
  evalPos(type, originalDepth) {
    if (this.blueWon) return 100_000_000 - originalDepth;
    if (this.redWon) return -100_000_000 + originalDepth;

    let indices = this.getPlayableIndices();
    let blue = type == BLUE;
    let lanes = blue ? this.blueLanes : this.redLanes;

    //Check if we have an immediate win.
    let win = this.playableLane(indices, lanes);
    if (win != null) {
      if (blue) return 100_000_000 - originalDepth;
      else return -100_000_000 + originalDepth;
    }

    let score = 0;
    //Blue and red lane counts
    let blueLaneCount = countProperties(this.blueLanes),
      redLaneCount = countProperties(this.redLanes);

    score = score + blueLaneCount * 1.2;
    score = score - redLaneCount * 1.2;

    for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
      if (this.board[i] == BLUE) score += evalTable[i];
      else if (this.board[i] == RED) score -= evalTable[i];
    }

    return score;
  }

  //Depth: Current depth
  //Player: Is it a maximizing player's turn?
  //IMPORTANT: Blue should be maximizing player, red should be minimizing player
  //Original depth: Obviously the original depth
  //Alpha and beta: look up minimax algorithm
  //Start time: time in milliseconds that the search started
  //Max time: max time in milliseconds that the search may last for
  minimax(
    depth,
    maximizingPlayer,
    originalDepth,
    alpha,
    beta,
    startTime,
    maxTime
  ) {
    if (Date.now() - startTime >= maxTime) return;

    //Depth we're currently at.
    let currentDepth = originalDepth - depth + 1;

    //If a player won, we might have some moves, but it's already over
    //We add the different between the original depth and the current depth
    //so that we prioritize wins that are quicker.
    if (this.blueWon) return 100_000_000 - currentDepth;
    if (this.redWon) return -100_000_000 + currentDepth;

    if (depth <= 1) {
      return this.evalPos(maximizingPlayer ? BLUE : RED, originalDepth);
    }
    let indices = this.getPlayableIndices();

    //No moves, it's a draw!
    if (indices.length == 0) return 0;

    let bestScore = maximizingPlayer
      ? Number.NEGATIVE_INFINITY
      : Number.POSITIVE_INFINITY;

    let squareType = maximizingPlayer ? BLUE : RED;

    if (maximizingPlayer) {
      for (let index of indices) {
        this.savePosToHistory();
        this.setSquare(index, squareType, true);

        if (Date.now() - startTime >= maxTime) {
          this.goToLastPos();
          return bestScore;
        }

        let score;

        // let cacheInd =
        //   this.board.toString() + "-" + (maximizingPlayer ? "B" : "R");
        // let data = this.cache[cacheInd];
        // if (data && depth - 1 <= data.depth) score = data.eval;
        // else {
        score = this.minimax(
          depth - 1,
          !maximizingPlayer,
          originalDepth,
          alpha,
          beta,
          startTime,
          maxTime
        );
        //   this.cache[cacheInd] = { depth: depth - 1, eval: score };

        //   //Free up room in the cache if it's already overflowing by removing the first position
        //   //that was added.
        //   if (countProperties(this.cache) > MAX_CACHE_SIZE) {
        //     delete this.cache[Reflect.ownKeys(this.cache)[0]];
        //   }
        // }

        this.goToLastPos();

        if (Date.now() - startTime >= maxTime) return bestScore;

        if (score > bestScore) bestScore = score;
        alpha = max(score, alpha);
        if (beta <= alpha) break;
      }
    }
    if (!maximizingPlayer) {
      for (let index of indices) {
        this.savePosToHistory();
        this.setSquare(index, squareType, true);

        if (Date.now() - startTime >= maxTime) {
          this.goToLastPos();
          return bestScore;
        }

        let score;

        // let cacheInd =
        //   this.board.toString() + "-" + (maximizingPlayer ? "B" : "R");
        // let data = this.cache[cacheInd];
        // if (data && depth - 1 <= data.depth) score = data.eval;
        // else {
        score = this.minimax(
          depth - 1,
          !maximizingPlayer,
          originalDepth,
          alpha,
          beta,
          startTime,
          maxTime
        );
        // this.cache[cacheInd] = { depth: depth - 1, eval: score };

        // Free up room in the cache if it's already overflowing by removing the first position
        // that was added.
        //   if (countProperties(this.cache) > MAX_CACHE_SIZE) {
        //     delete this.cache[Reflect.ownKeys(this.cache)[0]];
        //   }
        // }

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
    console.log(indices, this.floors);
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
      this.setSquare(index, BLUE, true);
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
    return bestMove;
  }
  bestMove(time = 1_000, maxDepth = 20, player = BLUE) {
    let start = Date.now();

    let blue = player == BLUE;
    let red = player == RED;

    let indices = this.getPlayableIndices();

    let bestMove = indices[0];

    for (let x = 1; x <= maxDepth; x += 1) {
      /*
      What are we doing here?
      We always update the best move with the best move OF THAT interation.
      As an example, say we're searching at depth 3, and red (the minimizing player) finds
      a play at index 23 that scores -100. We then search at depth 4, and red finds a play at
      index 20 that only scores -50. We'll still update the current best move as index 20.

      Why do we do this? Well, take our example. After searching at depth 4, red finds that
      the best play is index 20, which scores -50. If we then search at depth 5 and realize
      that playing at index 20 ACTUALLY yields a score of Infinity, red will OBVIOUSLY not want to
      play that, because that will lead to a win for blue. However, if we check whether or not we should
      update the best move, we would normally check if the current score is better than the last best score.
      -50 < INFINITY, so we would NOT update the best move and score. This means that by comparing the best move
      from seaches at depth n doesnn't account for realizing that best move is actually losing at a further depth.

      To compensate for that, we again update the best move with the best move of one SINGLE iteration.
      I.E., when we move on to depth 2, we will completely disregard the best move we found at depth 1.
      
      BUT, say the move in the first column is a losing move. If we go to depth, say, 7, and the search runs out
      of time after checking the FIRST move, we'll return that one even if we had a winning play. This is because,
      remember, we're using the best move from ONLY searches at depth 7.
      To fix this, after every search, we can update the move list to go from best to worst, based on the results from
      the previous search depth. In this way, we'll check the best possible moves first, so if we run out of time,
      there's a better chance we'll have already searched the winning move.
      */
      let newIndices = [];
      let scores = [];

      console.log("X's and o's", x, bestMove);
      for (let index of indices) {
        this.savePosToHistory();
        this.setSquare(index, player, true);

        if (Date.now() - start >= time) {
          this.goToLastPos();
          return bestMove;
        }

        let score = this.minimax(
          x,
          red,
          x,
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          start,
          time
        );
        this.goToLastPos();

        if (Date.now() - start >= time) return bestMove;

        //Format moves so that next iteration, we look at the most promising moves first

        //If we've found a losing move, we don't want to explore it at a lower depth,
        //so we only add moves if they have some kind of winning potential.
        if (
          (red && score != Number.POSITIVE_INFINITY) ||
          (blue && score != Number.NEGATIVE_INFINITY)
        ) {
          if (newIndices.length == 0) {
            newIndices.push(index);
            scores.push(score);
          } else {
            let ind = 0;
            for (let i = 0; i < scores.length; i += 1) {
              if (blue && scores[i] > score) ind += 1;
              if (red && scores[i] < score) ind += 1;
            }
            scores.splice(ind, 0, score);
            newIndices.splice(ind, 0, index);
          }
        }

        bestMove = newIndices[0] || indices[0];
      }
      indices = newIndices;
    }
    return bestMove;
  }

  //Debug purposes. Blue and red moves are integer arrays of columns to played.
  //Makes the blue's column move, then red's, then blue's, etc. -1 means don't make a move
  //for that particular side that turn.  By default, subtracts one from the columns.
  //E.G., if you pass 7 as a column and don't set subtract to true, the column at index 7 doesn't exist,
  //so behavior is undefined. If your column range IS 1-7 and NOT 0-6, set subtract to true.
  setBoardByMoves(blueMoves, redMoves, subtract = true) {
    for (let i = 0; i < Math.max(blueMoves.length, redMoves.length); i += 1) {
      let p = blueMoves[i] - (subtract ? 1 : 0),
        o = redMoves[i] - (subtract ? 1 : 0);
      if (!isNaN(p) && p >= 0) {
        this.setSquareOnColumn(p, BLUE);
      }
      if (!isNaN(o) && o >= 0) {
        this.setSquareOnColumn(o, RED);
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
  //the last (E) is at index 41. B means BLUE, R means RED, and E means EMPTY.
  //String may be less than 42 characters. Any spots not provided are presumed to be empty.
  setBoardByBoardStr(str) {
    let board = [];
    let i = WIDTH * HEIGHT;
    while (i-- > 0) board.push(EMPTY);

    str = str.toUpperCase();

    let c = -1;
    while (++c < str.length) {
      let p = str[c];
      if (p == "B") board[c] = BLUE;
      if (p == "R") board[c] = RED;
    }

    this.setBoardByArray(board);
  }
}

let cacheHits = 0;

const timeFunc = (c, f) => {
  console.time();
  for (let i = 0; i < c; i += 1) f();
  console.timeEnd();
};

let b = new Board();

function debugSetStartingPos() {
  console.log("CALCULATING");
  console.log(b.calcLanes(RED));
}
debugSetStartingPos();

const log = new debug.Log("./", {
  displayBoardPath:
    "file:///C:/Users/kiyaa/Project/Github/Connect-4-Bot/Web/board.html",
  newline: true,
});
log.clearLog();
log.write("new stuff!");

console.log(b.board);
// console.log(b.bestMoveDebug(5));
console.log("Bestest #1", b.bestMove(1000, 20, RED));
// console.log(countProperties(b.cache));
// debug.playBot(Board, log);
