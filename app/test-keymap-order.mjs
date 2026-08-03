// Verify CM6's precedence ordering semantics (the mechanism Prec.high relies on).
// Run with: npx tsx test-keymap-order.mjs
import { EditorState, Facet, Prec } from '@codemirror/state';

const testFacet = Facet.define();

// Facet values are returned ordered by precedence (high first).
const state = EditorState.create({
  extensions: [
    testFacet.of('default-first-registered'),
    Prec.high(testFacet.of('high-precedence')),
    testFacet.of('default-second'),
  ],
});

const values = state.facet(testFacet);
console.log('facet order:', values);

// CM6 buildKeymap concatenates facet values in this order, and for a shared
// key (e.g. Enter) runs the merged commands front-to-back until one returns
// true — so whichever run is FIRST wins.
const first = values[0];
console.log(first === 'high-precedence' ? '✓ Prec.high value comes first (our Enter wins)' : '✗ wrong order');

// Also verify two default-precedence keymaps keep REGISTRATION order
// (defaultKeymap first → its Enter would win without Prec.high).
const state2 = EditorState.create({
  extensions: [
    testFacet.of('a-default'),
    testFacet.of('b-default'),
  ],
});
console.log('default order:', state2.facet(testFacet));
