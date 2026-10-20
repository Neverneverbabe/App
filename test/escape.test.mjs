import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, escapeAttr } from '../modules/escape.js';

test('escapes markup, quotes and ampersands', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml('He said "hi" & <left>'), 'He said &quot;hi&quot; &amp; &lt;left&gt;');
  assert.equal(escapeAttr(`a'b"c`), 'a&#39;b&quot;c');
});

test('handles nullish and non-string values', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});
