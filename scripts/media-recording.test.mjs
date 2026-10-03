// Run the real recording entrypoints with unsupported/failed microphone APIs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const [file, name, next, recorder, statusId] of [
  ["index.html", "startAskRecord", "stopAskRecord", "askRecorder", "askStatus"],
  ["js/admin.js", "startAnswerRecord", "stopAnswerRecord", "answerRecord", "recstatus-test"]
]) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const start = source.indexOf("async function " + name + "(");
  const code = source.slice(start, source.indexOf("function " + next + "(", start));
  for (const failure of ["permission", "constructor", "start", null]) {
    let stopped = 0;
    const stream = { getTracks: () => [{ stop() { stopped++; } }] };
    const navigator = { mediaDevices: { async getUserMedia() {
      if (failure === "permission") throw new Error("denied");
      return stream;
    } } };
    class MediaRecorder {
      constructor() { if (failure === "constructor") throw new Error("unsupported"); }
      start() { if (failure === "start") throw new Error("codec unavailable"); }
    }
    const nodes = new Map();
    const element = id => { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); };
    const document = { getElementById: element, querySelector: element };
    const run = new Function("navigator", "MediaRecorder", "document", "$", "sBad",
      "let askChunks=[],askRecorder=null,answerAskId=null,answerChunks=[],answerRecord=null;" + code +
      "return {start:" + name + ",record:()=>" + recorder + "};"
    )(navigator, MediaRecorder, document, element, () => {});
    await run.start("test");
    if (failure) {
      assert.equal(stopped, failure === "permission" ? 0 : 1, file + " releases an acquired microphone after " + failure);
      assert.equal(run.record(), null);
      assert.match(element(statusId).textContent, /Microphone is not available/);
    } else {
      assert.equal(stopped, 0, "successful recording keeps the microphone active");
      assert.match(element(statusId).textContent, /Recording/);
      run.record().onstop();
      assert.equal(stopped, 1, "normal recording stop still releases the microphone");
    }
  }
}
console.log("ok - child and admin recording handle unavailable media and release acquired tracks");
