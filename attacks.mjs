import {
  WIDTH,
  HEIGHT,
  WINNING_LENGTH,
  EMPTY,
  PLAYER,
  OPPONENT,
} from "./globals.mjs";

//Clones 1D array of primitives
function clone1DArray(arr_) {
  let arr = [];
  for (let el of arr_) arr.push(el);
  return arr;
}

export function genAttacks() {
  const checkForConsecutives = (row, type) => {
    let consecutive = 0;
    for (let square of row) {
      if (square == type) consecutive += 1;
      else consecutive = 0;

      if (consecutive >= WINNING_LENGTH) return true;
    }
  };

  function genLanes(row, type) {
    let lanes = [];
    for (let x = 0; x < WIDTH; x += 1) {
      let square = row[x];
      if (square != EMPTY) continue;

      let row_ = clone1DArray(row);
      row_[x] = type;
      if (checkForConsecutives(row_, type)) lanes.push(x);
    }
    return lanes;
  }

  let attacks = {};

  let row = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < 3 ** WIDTH; i += 1) {
    row[0] += 1;
    let b = 0;
    while (row[b] > 2) {
      row[b] = 0;
      if (b < WIDTH - 1) row[b + 1] += 1;
      b += 1;
    }
    let ind = "b";
    for (let bit of row) ind += bit.toString();

    let playerLanes = genLanes(row, PLAYER);
    let opponentLanes = genLanes(row, OPPONENT);

    for (let y = 0; y < HEIGHT; y += 1) {
      let add = y * WIDTH;

      let playerLanesAdded = clone1DArray(playerLanes);
      for (let x = 0; x < playerLanes.length; x += 1)
        playerLanesAdded[x] += add;

      let opponentLanesAdded = clone1DArray(opponentLanes);
      for (let x = 0; x < opponentLanes.length; x += 1) {
        opponentLanesAdded[x] += add;
      }

      attacks[ind + "p1y" + y.toString()] = playerLanesAdded;
      attacks[ind + "p2y" + y.toString()] = opponentLanesAdded;
    }
  }

  return attacks;
}
