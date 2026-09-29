import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StaffOrderStart() {
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.setItem('kot_staff_order_mode', 'true');
    navigate('/menu', { replace: true });
  }, [navigate]);

  return null;
}
