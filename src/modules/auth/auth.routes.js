// auth.routes.js — rotas públicas de autenticação (RF_01, RF_02, RF_03).
import express from 'express';
import * as controller from './auth.controller.js';

const router = express.Router();

router.get('/login', controller.renderLoginForm);
router.post('/login', controller.login);
router.post('/logout', controller.logout);

// Recuperação de senha (RF_03): solicitação de link + redefinição por token.
router.get('/forgot-password', controller.forgotPassword);
router.post('/forgot-password', controller.solicitarRecuperacao);
router.get('/reset-password', controller.renderResetPassword);
router.post('/reset-password', controller.resetPassword);

export default router;
