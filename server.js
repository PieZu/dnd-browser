// init project
const express = require("express");
const app = express();
const fs = require("fs");
app.use(express.json());


// init sqlite db
const dbFile = "./.data/sqlite.db";
if (!(fs.existsSync(dbFile))) require('./init_db.js').then(()=>{console.log("nice")})
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);


db.all("SELECT * FROM Classes_Spells LEFT OUTER JOIN Spells ON Spells.id = spell_id LEFT OUTER JOIN Classes ON Classes.id = class_id WHERE spell_id=140", (e,r)=>console.log(e?e:JSON.stringify(r)))
// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});

app.use(express.urlencoded())
app.use(express.json());        // allows access to request.body (to extract post data)
app.use(express.static('public'))  // make files in the ./public/*.* directory GETable 

app.get("/sql/dupes", (request, response) => {
  let table = request.params.table 
  console.log(`sending json for table ${table}`)
  db.all(`SELECT * FROM Spells ORDER BY spell_name`, (err, rows) => {
    if (err) console.log(err)
    response.send(htmlTableFrom(tableifiedObjArray(rows)))
  });
})

app.get("/sql/:table", (request, response) => {
  let table = request.params.table 
  console.log(`sending json for table ${table}`)
  db.all(`SELECT * FROM ${table}`, (err, rows) => {
    if (err) console.log(err)
    response.send(htmlTableFrom(tableifiedObjArray(rows)))
  });
})

app.get("/spell/:id", (request, response) => {
  let spellId = request.params.id
  db.get(`SELECT spell.id, spell_name, spell_description, school.name AS school, level, casttime.name AS casttime, duration.name AS duration, verbal, somatic, material, materials, range.name AS range,
            (SELECT GROUP_CONCAT(Classes.name, ', ') FROM Classes_Spells JOIN Classes ON Classes.id == class_id WHERE spell_id = ?) AS classes
            FROM Spells AS spell
            LEFT OUTER JOIN Schools  AS school ON   school_id == school.id
            LEFT OUTER JOIN Distances AS range ON    range_id == range.id 
            LEFT OUTER JOIN Times AS casttime  ON casttime_id == casttime.id
            LEFT OUTER JOIN Times AS duration  ON duration_id == duration.id
            WHERE spell.id = ?
`, spellId, spellId, (err, rows)=>{
    if (err) console.log(err)
    response.send(rows)
  })
})

app.post("/spells/", (request, response) => {
  let filters = [],
      user_input  = [] // user input handled seperately to properly escape and prevent injections
  if (request.body.name)                  { filters.push(`spell_name LIKE (?)`);   user_input.push(request.body.name+"%") }
  if (request.body.somatic  != undefined) { filters.push(`spell.somatic = (?)`);   user_input.push(request.body.somatic) }
  if (request.body.verbal   != undefined) { filters.push(`spell.verbal = (?)`);    user_input.push(request.body.verbal) }
  if (request.body.material != undefined) { filters.push(`spell.material = (?)`);  user_input.push(request.body.material) }
  if (request.body.class)                 { filters.push(`classes LIKE (?)`);      user_input.push("%"+request.body.class+"%") }
  if (request.body.school)                { filters.push(`school = (?)`);          user_input.push(request.body.school) }
  if (request.body.minimumlevel)          { filters.push(`level >= (?)`);           user_input.push(request.body.minimumlevel) }
  
  var filter_text = "WHERE "+filters.join(" AND ")
  
  
  console.log(filter_text, user_input)
  db.all(`SELECT spell.id, spell_name, spell_description, school.name AS school, level, casttime.name AS casttime, duration.name AS duration, verbal, somatic, material, materials, range.name AS range,
            (SELECT GROUP_CONCAT(Classes.name, ', ') FROM Classes_Spells JOIN Classes ON Classes.id == class_id WHERE spell.id = spell_id GROUP BY spell_id) AS classes
            FROM Spells AS spell
            LEFT OUTER JOIN Schools  AS school ON   school_id == school.id
            LEFT OUTER JOIN Distances AS range ON    range_id == range.id 
            LEFT OUTER JOIN Times AS casttime  ON casttime_id == casttime.id
            LEFT OUTER JOIN Times AS duration  ON duration_id == duration.id
            ${filter_text}
            LIMIT 10`, ...user_input, (err, rows)=>{
    if (err) console.log(err)
    response.send(rows)
  })
})

app.get("/classList", (request, response) => {
  db.all("SELECT id, name FROM Classes", (err, rows)=>{
    if (err) console.log(err)
    response.send(rows)
  })
})
app.get("/schoolList", (request, response) => {
  db.all("SELECT id, name FROM Schools", (err, rows)=>{
    if (err) console.log(err)
    response.send(rows)
  })
})
/* 
Spells.id, spell_name, spell_description, school.name, casttime.name, duration.name, components, materials
              school_id INTEGER REFERENCES Schools (id),
              level INTEGER,
              casttime_id INTEGER REFERENCES Times (id),
              duration_id INTEGER REFERENCES Times (id),
              range_id INTEGER REFERENCES Distances (id),*/

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