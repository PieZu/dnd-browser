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


app.get("/sql/:table", (request, response) => {
  let table = request.params.table 
  console.log(`sending json for table ${table}`)
  db.all(`SELECT * FROM ${table}`, (err, rows) => {
    if (err) console.log(err)
    response.send(htmlTableFrom(tableifiedObjArray(rows)))
  });
})


function tableifiedObjArray(array) {
  /* turns an array with structure like:
       [{name: "Art",     lvl:0,  Desc:"Failing"}, 
        {name: "Maths",   lvl:4,  Desc:"Exceptional"}
        {name: "Science", lvl:2,  Desc:"Needs to do more homework"}] 
    into an array with structure like:
       [["name",    "lvl",  "Desc"],
        ["Art",     0,      "Failing"],
        ["Maths",   4,      "Exceptional"]
        ["Science", 2,      "Needs to do more homework"]] */
  
  let headers = Object.keys(array[0])
  let table = []
  table.push(headers)
  for (row of array) {
    table.push(headers.map(key=>row[key]))
  }
  return table
}

function htmlTableFrom(array) {
  // [["a", "b"], ["c", "d"]] --> '<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>'
  return "<table>" +
    ["",...array].reduce((full,row)=>full+
      "<tr><td>"+
          row.join("</td><td>")+
      "</td></tr>"
      )+
  "</table>"
}