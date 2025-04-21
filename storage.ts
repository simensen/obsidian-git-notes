import JSDB from '@small-tech/jsdb'





const storage = async (cb) => {
    const db = JSDB.open('/tmp/jsdb-db')

    if (!db.people) {
        console.log('init')
        db.people = [
        {name: 'Aral', age: 43},
        {name: 'Laura', age: 34}
        ]
    
        // Correct Laura’s age. (This will automatically update db/people.js)
        db.people[1].age = 33
    
        // Add Oskar to the family. (This will automatically update db/people.js)
        db.people.push({name: 'Oskar', age: 8})
    
        // Update Oskar’s name to use his nickname. (This will automatically update db/people.js)
        db.people[2].name = 'Osky'
    }

    cb(db)

    await db.close()
}


// setInterval(() => storage(db => db.people.forEach(person => person.age++)), 3000)

export default storage
