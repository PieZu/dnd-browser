// init project
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);


db.all("SELECT * FROM Classes_Spells LEFT OUTER JOIN Spells ON Spells.id = spell_id LEFT OUTER JOIN Classes ON Classes.id = class_id WHERE spell_id=140", (e,r)=>console.log(e?e:JSON.stringify(r)))
// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});