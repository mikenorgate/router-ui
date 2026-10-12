import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import { App } from './App';
import './styles.css';

const content = <AuthProvider><App /></AuthProvider>;
const preview = import.meta.env.MODE === 'design-preview';
// Opaque embedded frames cannot resolve history URLs. This exception is confined
// to the explicit preview build; the appliance always uses browser routes.
const application = preview
  ? window.location.origin === 'null'
    ? <MemoryRouter initialEntries={['/overview?demo=1']}>{content}</MemoryRouter>
    : <HashRouter>{content}</HashRouter>
  : <BrowserRouter>{content}</BrowserRouter>;
createRoot(document.getElementById('root')!).render(<StrictMode>{application}</StrictMode>);
