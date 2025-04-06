while (packages == undefined);
while (packages.board == null);

const repeat = (n, c) => {
  let s = "";
  while (c-- > 0) s += n;
  return s;
};
const url = new URL(window.location.href);
let pieces = (url.searchParams.get("board") ?? repeat(42, "e")).toLowerCase();

const squares = document.getElementsByClassName("square");
const board = document.getElementsByClassName("board")[0];

const winStatus = document.getElementsByClassName("win-status")[0];

// In milliseconds
let BOT_THINK_TIME = 30;

const botThinkTimeInput = document.getElementById("bot-think-time-input");
const botThinkTimeUnit = document.getElementById("bot-think-time-unit");
const timeSlider = document.getElementById("time-slider");

timeSlider.oninput = () => {
  let time = parseInt(timeSlider.value);
  botThinkTimeInput.value = time;

  if (time == 1) botThinkTimeUnit.innerHTML = "millisecond";
  else botThinkTimeUnit.innerHTML = "milliseconds";

  BOT_THINK_TIME = parseInt(timeSlider.value);
};
botThinkTimeInput.oninput = () => {
  let time = parseFloat(botThinkTimeInput.value);
  BOT_THINK_TIME = time;
  timeSlider.value = time;

  if (time == 1) botThinkTimeUnit.innerHTML = "millisecond";
  else botThinkTimeUnit.innerHTML = "milliseconds";
};

const HUMAN = 0;
const BOT = 1;
let bluePlayer = HUMAN;
let redPlayer = BOT;

//Is it red or blue's turn to move?
let player = BLUE;

//When a piece is falling down into its spot, how many milliseconds does it take
//to fall from one square to another
let squareFallTime = 20;
//Is a piece falling?
let animating = false;
//At what time did we last move a piece from one square to another in a animation?
let lastSquareMove = 0;
//At what column is the piece we're animating currently at?
let currentAnimationColumn = null;

//Are they playing against the bot?
const BOT_PLAY = true;

let game = new Board();

function suggestPieceOverColumn(col) {
  if (game.blueWon || game.redWon) return false;
  if (animating) return false;
  let square = squares[col];
  square.classList.add("suggested");
  square.classList.remove("suggested-red", "suggested-blue");
  square.classList.add(`suggested-${player == RED ? "red" : "blue"}`);
}
function removeSuggestedPiece(col) {
  let square = squares[col];
  square.classList.remove("suggested");
  square.classList.remove("suggested-red", "suggested-blue");
}

//Make a square on the board clear, red, or blue
//Note that y-values are inverted. I.E., if you put in 1,
//the square at the y-ind 4 will be altered.
const clear = (x, y) => {
  let square = squares[x + y * 7];
  square.classList.remove("red", "blue");
};
const red = (x, y) => {
  clear(x, y);
  squares[x + y * 7].classList.add("red");
};
const blue = (x, y) => {
  clear(x, y);
  squares[x + y * 7].classList.add("blue");
};

//Ad a piece to a column
function slideInPiece(col) {
  if (game.blueWon || game.redWon) return false;

  //Are we already animating something?
  if (animating) return false;

  //Is the column already full?
  if (game.board[7 * 5 + col] != EMPTY) return;
  lastSquareMove = Date.now();

  currentAnimationColumn = 5;
  let floor = 7;

  for (let ind = col; ind < 6 * 7; ind += 7) {
    if (game.board[ind] == EMPTY) {
      floor = (ind - (ind % 7)) / 7;
      break;
    }
  }

  animating = true;
  removeSuggestedPiece(col);
  animateSlideIn(col, floor);
}
function animateSlideIn(col, floor) {
  if (game.blueWon || game.redWon) return false;

  //We're not ready to continue the animation!!
  if (Date.now() - lastSquareMove < squareFallTime) {
    return window.requestAnimationFrame(() => animateSlideIn(col, floor));
  }
  //We've already fully animated the piece
  if (currentAnimationColumn < floor) {
    animating = false;
    currentAnimationColumn = null;
    game.setSquareOnColumn(col, player);
    player = player == RED ? BLUE : RED;

    if (
      ((player == RED && redPlayer == BOT) ||
        (player == BLUE && bluePlayer == BOT)) &&
      BOT_PLAY
    ) {
      botPlay(player);
    }

    handleWin();

    return;
  }

  if (currentAnimationColumn < 5) clear(col, 5 - currentAnimationColumn - 1);

  if (player == RED) red(col, 5 - currentAnimationColumn);
  else blue(col, 5 - currentAnimationColumn);

  lastSquareMove = Date.now();
  currentAnimationColumn -= 1;
  window.requestAnimationFrame(() => animateSlideIn(col, floor));
}

function botPlay(player) {
  //Is the board COMPLETELY full?
  for (let i = 0; i < game.floors.length; i += 1) {
    if (game.floors[i] < 6) break;
    if (i == game.floors.length - 1) return;
  }

  let best = game.bestMove(BOT_THINK_TIME, 20, player);
  console.log(best);
  slideInPiece(best % 7);
}

//Get indices of winning squares after a win has occurred (since   vn.,m,)
function getWinningIndices(type) {
  let indices = [];

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

    for (let x = 0; x < WIDTH - WINNING_LENGTH + 1; x += 1) {
      let square = game.board[x + y];

      let row_ = game.board.slice(y + x, y + x + WINNING_LENGTH);
      if (checkForConsecutives(row_)) {
        for (let i = 0; i < 4; i += 1) indices.push(x + y + i);
        return indices;
      }
    }
  }

  //Add columns
  for (let column = 0; column < WIDTH; column += 1) {
    //Number of pieces in a row we've found
    let consecutive = 0;

    for (let y = 0; y < HEIGHT; y += 1) {
      let index = column + y * WIDTH;
      let square = game.board[index];
      if (square == type) consecutive += 1;

      if (consecutive == 4) {
        for (let i = 0; i < 4; i += 1) indices.push((y - i) * WIDTH + column);
        return indices;
      }

      if (square != type) consecutive = 0;
    }
  }
  //Add diagonals
  for (let index of game.diagonalCheckStarts) {
    let lineLength = WIDTH - (index % WIDTH);

    //Set array that will store the pieces in the left-to-right diagonal on the board
    //and the left-to-right diagonal on the mirrored board.
    let diagonal = [],
      mirrorDiagonal = [];

    let currentIndex = index;

    while (lineLength-- > 0) {
      diagonal.push(game.board[currentIndex]);
      mirrorDiagonal.push(game.mirroredBoard[currentIndex]);
      currentIndex = currentIndex + WIDTH + 1;
    }

    for (let i = 0; i < diagonal.length; i += 1) {
      if (checkForConsecutives(diagonal.slice(i, i + WINNING_LENGTH))) {
        let ind = index + (WIDTH + 1) * i;
        for (let h = 0; h < 4; h += 1) indices.push(ind + (WIDTH + 1) * h);
        return indices;
      }
      if (checkForConsecutives(mirrorDiagonal.slice(i, i + WINNING_LENGTH))) {
        let ind = Board.mirrorIndex(index) + (WIDTH - 1) * i;
        for (let h = 0; h < 4; h += 1) indices.push(ind + (WIDTH - 1) * h);
        return indices;
      }
    }
  }

  return indices;
}

function handleWin() {
  if (!game.blueWon && !game.redWon) return;

  if (game.blueWon) {
    winStatus.innerHTML = "Blue Wins!";
    winStatus.classList.add("win-status-visible", "win-status-blue");
  }
  if (game.redWon) {
    winStatus.innerHTML = "Red Wins!";
    winStatus.classList.add("win-status-visible", "win-status-red");
  }

  //Make all pieces but the ones part of the win faded
  let type = game.blueWon ? BLUE : RED;
  let indices = getWinningIndices(type);
  for (let i = 0; i < squares.length; i += 1) {
    let boardInd = squareElementIndexToBoardIndex(i);
    let piece = game.board[boardInd];

    if (piece == EMPTY) continue;
    if (piece != type) {
      squares[i].classList.add("faded");
      continue;
    }

    console.log(indices, boardInd);
    if (!indices.includes(boardInd)) squares[i].classList.add("faded");
  }
}

game = new Board();

const squareElementIndexToBoardIndex = (i) => 35 - i + 2 * (i % 7);

//Create board
for (let i = 0; i < 6 * 7; i += 1) {
  let square = squares[i];

  let ind = squareElementIndexToBoardIndex(i);
  let piece = pieces[ind];

  if (piece == "b") {
    square.classList.add("blue");
    game.setSquare(ind, BLUE);
  }
  if (piece == "r") {
    square.classList.add("red");
    game.setSquare(ind, RED);
  }

  square.ondragstart = () => false;
  square.onmousemove = () => suggestPieceOverColumn(i % 7);
  square.onmouseout = () => removeSuggestedPiece(i % 7);
  square.onclick = () => slideInPiece(i % 7);
}

//Random chance if bot should go first or not.
let botFirst = Math.random() > 0.5;
if (botFirst && BOT_PLAY) {
  botPlay(player);
  player = player == BLUE ? RED : BLUE;
}
