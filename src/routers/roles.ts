import * as controller from '../controllers/roles';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const roles = express.Router({ mergeParams: true });

/**
 * Get all roles
 * GET /api/roles
 */
roles.get('/', controller.getAllRoles);

/**
 * Not allowed handler
 */
roles.all('/', returnNotAllowed(['get']));

export default roles;
