// auth.routes.js — rotas públicas de autenticação (RF_01, RF_02, RF_03).
import express from 'express';
import * as controller from './auth.controller.js';

const router = express.Router();

router.get('/login', controller.renderLoginForm);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
// RF_03 (recuperação de senha por e-mail) está fora do MVP — stub "em breve".
router.get('/forgot-password', controller.forgotPassword);

export default router;