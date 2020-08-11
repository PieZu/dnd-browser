const fs = require('fs');
const readline = require('readline');



function parse(filepath, callback) {
  // reads a tsv file and callbacks a well formatted object of each line one at a time
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
}


var Classes = []
var Schools = []
var Times = []
var Distances = []
var Spells = []

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
  , [normalisedMaterials, normalisedDescription] = spell.Description.match(/(?:\((.*?)\))?(.+)/)/* then we select just the 2 matched groups with ->*/.slice(1,2) 
  
  Spells.push({
    "name":        spell.Name,
    "description": normalisedDescription,
    "school_id":   asLookup(Schools, normalisedSchool),
    "level":       spell.Level,
    "casttime_id": asLookup(Times, spell["Casting Time"]),
    "duration_id": asLookup(Times, spell.Duration),
    "components":  boolArrayToNumber([V, S, M]),
    "materials":   normalisedMaterials,
    "range_id":    asLookup(Distances, spell.Range),
    "class_id":    asLookup(Classes, normalisedClass)
  })
}

function asLookup(array, value) {
  return array.indexOf(value)+1 || array.push(value)
}

function boolArrayToNumber(array) {
  return array.reduce((res, x) => res << 1 | x)
} 

parse("druidsheet.tsv", addSpell)