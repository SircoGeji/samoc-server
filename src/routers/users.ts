import * as controller from '../controllers/users';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const users = express.Router({ mergeParams: true });

users.post('/login', controller.userLogin);
users.get('/logout', controller.userLogout);

/**
 * Not allowed handler
 */
users.all('/', returnNotAllowed(['post', 'delete']));
users.all('/login', returnNotAllowed(['post']));
users.all('/logout', returnNotAllowed(['get']));

export default users;
