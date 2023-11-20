while (packages == undefined);
while (packages.board == null);

const repeat = (n, c) => {
  let s = "";
  while (c-- > 0) s += n;
  return s;
};
const url = new URL(window.location.href);
let pieces = (url.searchParams.get("board") ?? repeat(42, "e")).toLowerCase();

const squares = [];

const board = document.getElementsByClassName("board")[0];

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

let game = new Board();

function suggestPieceOverColumn(col) {
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
      (player == RED && redPlayer == BOT) ||
      (player == BLUE && bluePlayer == BOT)
    ) {
      botPlay(player);
    }

    if (game.redWon && !game.blueWon) {
      document.getElementsByClassName(
        "win-status-DEBUG-CHANGE-LATER"
      )[0].innerHTML = "Red Wins!";
    }
    if (game.blueWon && !game.redWon) {
      document.getElementsByClassName(
        "win-status-DEBUG-CHANGE-LATER"
      )[0].innerHTML = "Blue Wins!";
    }

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

  let best = game.bestMove(1_00, 20, player);
  console.log(best);
  slideInPiece(best % 7);
}

game = new Board();

//Create board
for (let i = 0; i < 6 * 7; i += 1) {
  let square = document.createElement("div");
  square.ondragstart = () => false;
  square.classList.add("square");

  let ind = 35 - i + 2 * (i % 7);
  let piece = pieces[ind];

  if (piece == "b") {
    square.classList.add("blue");
    game.setSquare(ind, BLUE);
  }
  if (piece == "r") {
    square.classList.add("red");
    game.setSquare(ind, RED);
  }

  square.onmousemove = () => suggestPieceOverColumn(i % 7);
  square.onmouseout = () => removeSuggestedPiece(i % 7);
  square.onclick = () => slideInPiece(i % 7);

  board.appendChild(square);
  squares.push(square);
}
