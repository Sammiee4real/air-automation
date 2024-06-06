import express from 'express';

import {createUser, getUsers, getUser, updateUser, deleteUser} from '../controllers/users.js';

const router = express.Router();

//all routes here starts with /users
router.get('/', getUsers);

router.post('/', createUser);

router.get('/:id',getUser);

router.patch('/:id', updateUser)

 router.delete('/:id',deleteUser)

export default router;