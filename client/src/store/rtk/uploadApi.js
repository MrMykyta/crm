import { crmApi } from './crmApi';

const normOwnerType = (t) => {
  const n = String(t || '').toLowerCase();
  if (n === 'user' || n === 'users') return 'users';
  if (n === 'company' || n === 'companies') return 'companies';
  if (n === 'counterparty' || n === 'counterparties') return 'counterparties';
  throw new Error('Bad ownerType');
};

export const uploadApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    uploadFile: build.mutation({
      query: ({ ownerType, ownerId, file, purpose = 'file', companyId, uploadedBy }) => {
        const urlType = normOwnerType(ownerType);
        const fd = new FormData();
        if (companyId) fd.append('companyId', companyId);
        if (uploadedBy) fd.append('uploadedBy', uploadedBy);
        fd.append('file', file);
        return {
          url: `/uploads/${urlType}/${ownerId}?purpose=${encodeURIComponent(purpose)}`,
          method: 'POST',
          body: fd,
        };
      },
    }),

    attachFromUrl: build.mutation({
      query: ({ ownerType, ownerId, remoteUrl, purpose = 'file', companyId, filename, mime, uploadedBy }) => {
        const urlType = normOwnerType(ownerType);
        const body = { url: remoteUrl, companyId, filename, mime, uploadedBy };
        return {
          url: `/uploads/by-url/${urlType}/${ownerId}?purpose=${encodeURIComponent(purpose)}`,
          method: 'POST',
          body,
        };
      },
    }),
  }),
});

export const { useUploadFileMutation, useAttachFromUrlMutation } = uploadApi;