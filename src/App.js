import React from 'react';
import { DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import FolderDrop from './FolderDrop';

const App = () => <FolderDrop />;

export default DragDropContext(HTML5Backend)(App);
