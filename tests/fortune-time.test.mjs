import assert from "node:assert/strict";
import {test} from "node:test";
import {validFortuneTime,conflictingWorkshop,FORTUNE_MAX_SLOTS,FORTUNE_SLOT_MINUTES} from "../lib/guest/fortune.ts";
test("15-minute event slots and 3.5-hour cap",()=>{
 assert.equal(FORTUNE_MAX_SLOTS*FORTUNE_SLOT_MINUTES,210);
 for(const value of ["14:00","18:15","22:45","23:45"])assert.equal(validFortuneTime(value),true);
 for(const value of ["13:45","24:00","18:16","18:1",undefined])assert.equal(validFortuneTime(value),false);
});
test("only overlapping workshop times are blocked",()=>{
 assert.equal(conflictingWorkshop(["sound"],"14:45"),undefined);
 assert.equal(conflictingWorkshop(["sound"],"15:00"),"sound");
 assert.equal(conflictingWorkshop(["sound"],"16:00"),"sound");
 assert.equal(conflictingWorkshop(["sound"],"16:15"),undefined);
 assert.equal(conflictingWorkshop(["scent"],"16:15"),undefined);
 assert.equal(conflictingWorkshop(["scent"],"17:45"),"scent");
 assert.equal(conflictingWorkshop(["scent"],"18:00"),undefined);
 assert.equal(conflictingWorkshop(["style"],"18:00"),"style");
 assert.equal(conflictingWorkshop(["style"],"18:45"),"style");
 assert.equal(conflictingWorkshop(["style"],"19:00"),undefined);
 assert.equal(conflictingWorkshop(["sound","scent","style"],"20:30"),undefined);
});
