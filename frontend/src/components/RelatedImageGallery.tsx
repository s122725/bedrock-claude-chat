import React, { useState } from 'react';

type BaseProps = {
  // 他のプロパティがある場合はここに追加
};

type Props = BaseProps & {
  imageUrls: string;
  idx: number;
};

const ImageModal: React.FC<Props> = ({ imageUrls, idx }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleImageClick = () => {
    setIsOpen(true);
  };

  const handleModalClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  return (
    <>
      <img
        src={imageUrls}
        alt={`Thumbnail ${idx}`}
        style={{ maxWidth: '200px', cursor: 'pointer' }}
        onClick={handleImageClick}
      />
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
          onClick={handleModalClick}
        >
          <img
            src={imageUrls}
            alt={`Image ${idx}`}
            style={{ maxWidth: '90%', maxHeight: '90%' }}
          />
        </div>
      )}
    </>
  );
};

const RelatedImageGallery: React.FC<{ relatedDocuments: { sourceLink: string }[] }> = ({
  relatedDocuments,
}) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {relatedDocuments.map((doc, idx) => (
        <div key={idx} style={{ margin: '0.5rem' }}>
          <ImageModal imageUrls={doc.sourceLink} idx={idx} />
        </div>
      ))}
    </div>
  );
};

export default RelatedImageGallery;