import api from '../services/api.service';

export async function UploadFile({ file, purpose }) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'X-Upload-Purpose': purpose,
    },
  });

  return response.data;
}
