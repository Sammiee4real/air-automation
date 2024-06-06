import { v4 as uuidv4} from 'uuid';

let users = [
    {
        id: uuidv4(),
        name:"Samuel",
        last:"Ade",
        age:20
    },
    {
        id: uuidv4(),
        name:"Kelvin",
        last:"Orimolade",
        age:22
    }
] 

export const createUser = (req,res) => {
    const newUser = req.body;
    const newUserWithId = { id: uuidv4(), ...newUser };
    console.log(newUserWithId); //test
    users.push(newUserWithId);
    res.send(users);
 };

 export const getUsers = (req,res) => {
    console.log(users);
    res.send(users);
 };

 export const getUser =  (req,res) => {
    const {id} = req.params;
    const getUser = users.find( (user) => user.id == id);
    if(getUser){
        res.send(getUser);
    }else{
        res.send('Record not found');
    }
 };

 export const updateUser = (req,res) => {
    const {id} = req.params;
    const {name, last, age} = req.body;
    const userToUpdate = users.find(  (user) => user.id ===  id );
    if(name){
        userToUpdate.name = name;
    } 
    if(last){
        userToUpdate.last = last;
    } 
    if(age){
        userToUpdate.age = age;
    } 
   

    res.send(userToUpdate);
};

export const deleteUser =  (req,res) => {
    const {id} = req.params;
    const users = users.filter( (user) => user.id !== id); //removes the one that DOES NOT fulfil the condition
    res.send('Record of the user has been deleted');
    
 };

 