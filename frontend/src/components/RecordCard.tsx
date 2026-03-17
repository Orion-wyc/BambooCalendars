import React, { useState } from 'react';
import { Card, Button, Input, Popconfirm, message, Space } from 'antd';
import { EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import type { Record } from '../types';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface RecordCardProps {
  record: Record;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const RecordCard: React.FC<RecordCardProps> = ({ record, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(record.content);
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setEditingContent(record.content);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditingContent(record.content);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editingContent.trim()) {
      message.error('内容不能为空');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(record.id, editingContent.trim());
      message.success('更新成功');
      setIsEditing(false);
    } catch (error) {
      message.error('更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(record.id);
      message.success('删除成功');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const formatTime = (dateString: string) => {
    const date = dayjs(dateString);
    const now = dayjs();
    const diffHours = now.diff(date, 'hour');
    
    if (diffHours < 1) {
      return `${now.diff(date, 'minute')} 分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours} 小时前`;
    } else if (diffHours < 48) {
      return '昨天';
    } else {
      return date.format('MM-DD HH:mm');
    }
  };

  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      bodyStyle={{ padding: '12px' }}
    >
      {isEditing ? (
        <div>
          <TextArea
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
            rows={4}
            style={{ marginBottom: 8 }}
          />
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={isSaving}
              size="small"
            >
              保存
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={handleCancel}
              size="small"
            >
              取消
            </Button>
          </Space>
        </div>
      ) : (
        <div>
          <div
            style={{
              marginBottom: 8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.6',
              color: '#333',
            }}
          >
            {record.content}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#999', fontSize: '12px' }}>
              {formatTime(record.created_at)}
            </span>
            <Space size="small">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={handleEdit}
                size="small"
                style={{ padding: '4px 8px' }}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定删除这条记录吗？"
                onConfirm={handleDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                  style={{ padding: '4px 8px' }}
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </div>
        </div>
      )}
    </Card>
  );
};

export default RecordCard;