const fs = require('fs');
const readline = require('readline');



function parse(filepath, callback) {
  // reads a tsv file and callbacks a well formatted object of each line one at a time
  
  
  // relies on a readInterface which is asynchronous, so we return a promise to let the rest of the code know when its finished parsing.
  return new Promise(resolve => {
    var isHeader = true
    var headers = []

    const readInterface = readline.createInterface({
      input: fs.createReadStream(filepath),
      output: process.stdout
    });

    readInterface.on('line', function(line) {
      let columns = line.split("\t")

      if (isHeader) { // on first line, just set it to headers, used as keys for objects
        headers = columns
        isHeader = false
      } else {
        // create an object with headers as keys and data as values
        let lineObject = {}
        for (let i=0; i<columns.length; i++) {
          lineObject[headers[i]] = columns[i]
        }
        callback(lineObject)
      }
    });

    readInterface.on('close', function() {
      // end of file reached
      resolve()
    });
  })
}

// this capitalisation convention usually indicates a class in js but im doing it for global arrays just to match the sql table names. i dont use any custom classes so hopefully isnt confusing.
var Classes = [],
    Schools = [],
    Times = [],
    Distances = [],
    Spells = [],
    Classes_Spells = [],

// then put em all in an object just so we can access them dynamically easier n stuff dont worry bout a thing\
tables = {"Classes": Classes, "Schools": Schools, "Times": Times, "Distances": Distances, "Spells": Spells, "Classes_Spells": Classes_Spells}

function addSpell(spell) {
  // -- normalise data --
  // class "Druid", "Druid(EE)", & "Druid (Arctic) should all be read as "Druid"
  //console.log(Object.keys(spell))
  let normalisedClass = spell.Class.split(/[ (]/)[0]
  // school has redundant data: "Transmutation cantrip", "1st level Transmutation" & "9th level Transmutation" should all be read as "Transmutation" (level is already stored seperately)
    , normalisedSchool = spell.School.replace(/... level | cantrip/, "")
  // components is given as a string; we want to split it into three booleans of if it contains each component  
  , [V, S, M] = [spell.Components.includes('V'), spell.Components.includes('S'), spell.Components.includes('M')]
  // the description column contains the description AND the materials (if any) in the format `${materials?'('+materials+')':''}${description}`. which we split with this unreadable RegExp
  // /(?:\((.*?)\))?(.+)/ <- full regexp
  // /(?:         )?    / <- 0or1 quantified non-matching group. makes inner contents optional
  // /             (.+) / <- 1+ quantified dot group. matches as many characters as possible (1+) and returns as seperate group in the output, the description. if the previous part is empty, this will be the whole string, otherwise this will be everything after it
  // /   \(     \)      / <- escaped brackets. matches the characters ( <inner content> )
  // /     (.*?)        / <- lazy 0+ quantified dot group. matches as few characters as possible (including 0) that satisfy the rest of the expression. returns as seperate group in output, the materials
  , [normalisedMaterials, normalisedDescription] = spell.Description.match(/(?:\((.*?)\))?(.+)/)/* then we select just the 2 matched groups with ->*/.slice(1) 
  
  // check if spell already exists (array item with same name&description), data contains duplicate spell rows with different classes (its a many-many relationship).
  , spellId = Spells.findIndex( ({name, description})  =>  name==spell.name && description==normalisedDescription ) +1
  
  
  // -- add data to table --
  if (spellId) {
    // if spell already has an id, just add a thing to the Classes_Spells array
    Classes_Spells.push(asLookup(Classes, normalisedClass), spellId)
  } else {
    // otherwise, add the whole thingy
    spellId = Spells.push({
      "name":        spell.Name,
      "description": normalisedDescription,
      "school_id":   asLookup(Schools, normalisedSchool),
      "level":       spell.Level,
      "casttime_id": asLookup(Times, spell["Casting Time"]),
      "duration_id": asLookup(Times, spell.Duration),
      "range_id":    asLookup(Distances, spell.Range),
      "components":  boolArrayToNumber([V, S, M]),
      "materials":   normalisedMaterials
    })
    // dont forget the class associated with it
    Classes_Spells.push(asLookup(Classes, normalisedClass), spellId)
  }
}

function asLookup(array, value) {
  // a lil functiononi for easy foreign keys
  // if the value already exists in array, will return the index of it +1 (js indexes start at 0, sql indexes start at 1)
  // if the value isnt in the array then indexOf will return -1, -1+1=0, 0 is a falsey value so it will instead return the right hand side of the ||, which pushes the value onto the end of the array and returns the new array length (which is the same as the index of inserted value +1)
  return array.indexOf(value)+1 || array.push(value)
}

function boolArrayToNumber(array) {
  // since we dont have sets in SQLite this is a quick implementation of it
  // turns like [true, false, true] into binary 101 which js stores as number 5
  // reversed with <Number>.toString(2)  .split("")
  return array.reduce((res, x) => res << 1 | x)
} 

const sheetDir = './source/'
Promise.all(                             // waits until all the promises (async code) finish (so that everything is parsed)
  fs.readdirSync(sheetDir).map(file =>  // makes an array for each file in specified folder
    parse(sheetDir+file, addSpell)       // parses said file. returns a promise which goes into the array which is waited for wil Promise.all
  )
).then(()=>{
  try{
  // when the code reaches here, it's parsed all the tsv data into some nice arrays
  // now its time to put those arrays into good old SQL with all the goodies like permenance n stuff
  
  // init sqlite db
  const databasePath = "./.data/sqlite.db";
  const sqlite3 = require("sqlite3").verbose(); // read up https://www.npmjs.com/package/sqlite3
  const db = new sqlite3.Database(databasePath, console.log);
  
  db.serialize(()=>{
    // serialize means the database will run our commands in order 
    
    // first, lets create all the lookup tables. done with a loop because it's very repetitive
    ["Schools", "Classes", "Distances", "Times"].forEach(table=>{
      
      db.run(`DROP TABLE IF EXISTS ${table}`) // we erase any previous data
      db.run(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${table}_name TEXT)`) // create the table
      let statement = db.prepare(`INSERT INTO ${table} (${table}_name) VALUES (?)`) //
      tables[table].forEach(x=>{statement.run(x)})
      statement.finalize()
      
    })
    
    // okay big girl time for the spells table
    db.run("DROP TABLE IF EXISTS Spells")
      .run(`CREATE TABLE Spells (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spell_name TEXT,
            spell_description TEXT,
            school_id INTEGER REFERENCES Schools (id),
            level INTEGER,
            casttime_id INTEGER REFERENCES Times (id),
            duration_id INTEGER REFERENCES Times (id),
            range_id INTEGER REFERENCES Distances (id),
            components INTEGER,
            materials TEXT
      )`) /**/
    let statement = db.prepare("INSERT INTO Spells (spell_name, spell_description, school_id, level, casttime_id, duration_id, range_id, components, materials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    Spells.forEach(spell=>{statement.run(Object.values(spell))})
    statement.finalize() 
    
    // you did perfect! my perfect pet. theres just one more table the Classes_Spells relationship thingo
    db.run("DROP TABLE IF EXISTS Classes_Spells")
      .run("CREATE TABLE Classes_Spells (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER REFERENCES Classes (id), spell_id INTEGER REFERENCES Spells (id))")
    statement = db.prepare("INSERT INTO Classes_Spells (class_id, spell_id) VALUES (?, ?)")
    Classes_Spells.forEach((a,b)=>{statement.run(a,b)})
    
    // wonderful. marvelous. lets check its done
    console.log("Initialisation complete")
    for (x in tables) {
      let tableName = x
      db.get("SELECT COUNT(*) AS n FROM "+tableName, (e, results)=>console.log(e?e:`Table ${tableName} has ${results.n} rows`))
    }/**/
  })
  
}catch(e){console.log(e)}  
});
