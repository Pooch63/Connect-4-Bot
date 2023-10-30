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
