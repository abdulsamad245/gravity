import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { BoardsPage } from '../features/boards/BoardsPage';
import { LandingPage } from '../features/landing/LandingPage';
import { RoomPage } from '../features/canvas/RoomPage';
import { DialogHost } from '../shared/components/DialogHost';
import { roomPath } from '../shared/utils/room-path';
import { ErrorBoundary } from './ErrorBoundary';

/** Old `/room/:id` invite links → canonical `/rooms/:id`. */
function LegacyRoomRedirect() {
  const { roomId } = useParams<{ roomId: string }>();
  if (!roomId) return <Navigate to="/rooms" replace />;
  return <Navigate to={roomPath(roomId)} replace />;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/rooms" element={<BoardsPage />} />
          <Route path="/rooms/:roomId" element={<RoomPage />} />
          <Route path="/boards" element={<Navigate to="/rooms" replace />} />
          <Route path="/room/:roomId" element={<LegacyRoomRedirect />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
      <DialogHost />
    </ErrorBoundary>
  );
}
