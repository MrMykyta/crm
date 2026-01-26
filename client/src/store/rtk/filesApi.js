import { crmApi } from './crmApi';

// Unified Files API
export const filesApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getSignedFileUrl: build.query({
      query: (id) => ({
        url: `/files/${encodeURIComponent(id)}/signed-url`,
        method: 'POST',
      }),
      keepUnusedDataFor: 60 * 60 * 24,
    }),
    getSignedPreviewUrl: build.query({
      query: (id) => ({
        url: `/files/${encodeURIComponent(id)}/signed-url`,
        method: 'POST',
      }),
      keepUnusedDataFor: 60 * 60 * 24,
    }),
    getSignedDownloadUrl: build.query({
      query: (id) => ({
        url: `/files/${encodeURIComponent(id)}/signed-download`,
        method: 'POST',
      }),
      keepUnusedDataFor: 60 * 5,
    }),

    uploadFile: build.mutation({
      query: ({ ownerType, ownerId, file, purpose = 'file', visibility = 'private' }) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('ownerType', ownerType);
        fd.append('ownerId', ownerId);
        fd.append('purpose', purpose);
        fd.append('visibility', visibility);

        return {
          url: '/files/upload',
          method: 'POST',
          body: fd,
        };
      },
    }),

    deleteFile: build.mutation({
      query: (id) => ({
        url: `/files/${id}`,
        method: 'DELETE',
      }),
    }),

    listFilesByOwner: build.query({
      query: ({ ownerType, ownerId, purpose }) => {
        const params = {};
        if (ownerType) params.ownerType = ownerType;
        if (ownerId) params.ownerId = ownerId;
        if (purpose) params.purpose = purpose;
        return { url: '/files', params };
      },
    }),
  }),
});

export const {
  useGetSignedFileUrlQuery,
  useLazyGetSignedFileUrlQuery,
  useGetSignedPreviewUrlQuery,
  useLazyGetSignedDownloadUrlQuery,
  useGetSignedDownloadUrlQuery,
  useUploadFileMutation,
  useDeleteFileMutation,
  useListFilesByOwnerQuery,
} = filesApi;
