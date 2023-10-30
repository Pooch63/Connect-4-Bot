function calcLanes(type) {
  let lanes = {};
  const OPPOSING = type == PLAYER ? OPPONENT : PLAYER;

  console.time("Row");
  for (let i = 0; i < 10_000; i += 1) {
    //Add rows
    for (let row = 0; row < HEIGHT; row += 1) {
      //Number of pieces in a row we've found
      let y = row * HEIGHT;
      let consecutive = 0;

      //Store the last empty square we found, so that if we find that there
      //is an empty square between three of our pieces, we mark it as a lane.
      let lastEmpty = null;
      let updatedLastEmpty = false;

      for (let x = 0; x < WIDTH; x += 1) {
        if (WIDTH - x + 1 < WINNING_LENGTH - consecutive) break;

        let index = x + y;
        let square = this.board[index];

        if (square == OPPOSING) {
          consecutive = 0;
          updatedLastEmpty = false;
        }
        if (square == type) consecutive += 1;

        if (square == EMPTY) {
          //If we're at an empty square after 3 or more of our pieces in a row,
          //include it as a lane.
          if (consecutive >= WINNING_LENGTH - 1) {
            lanes[index] = 1;
            updatedLastEmpty = false;
            consecutive = 0;
          }

          //Update the last empty square we've seen. If we've already seen an empty square
          //in our potential winning chain of pieces, that means that it's no longer possible
          //to complete the chain we've seen, and we're starting from scratch.
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
      }
    }
  }
  console.timeEnd("Row");
  console.time("Col");
  for (let i = 0; i < 10_000; i += 1) {
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
  }
  console.timeEnd("Col");
  console.time("Diag");
  for (let i = 0; i < 10_000; i += 1) {
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
  }
  console.timeEnd("Diag");

  return lanes;
}
