import React from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { io } from 'socket.io-client';
import './App.css';
import Dashboard from './components/Dashboard';
import GuardedRoute from './components/GuardComponent';
import SignupComponent from './components/SignupComponent';
import SigninComponent from './components/SigninComponent';
import MultiPlayerGame from './components/MultiPlayerGame';

var socket = io('http://localhost:8080')

function App() {

  const router = createBrowserRouter([
    {
      path: "/",
      element: <SignupComponent socket={socket} />,
    },
    {
      path: "/signin",
      element: <SigninComponent socket={socket} />,
    },
    {
      path: "/dashboard",
      element: <GuardedRoute component={Dashboard} socket={socket} />
    },
    {
      path: 'playing',
      element: <GuardedRoute component={MultiPlayerGame} socket={socket} />
    }
  ]);

  return (
    <RouterProvider router={router}>
      
    </RouterProvider>
  );
}

export default App;