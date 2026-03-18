import React, { useState } from 'react';
import { Card, Button, Input, Popconfirm, message, Space, Checkbox } from 'antd';
import { EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import type { Step } from '../types';

const { TextArea } = Input;

interface StepCardProps {
  step: Step;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onToggleComplete: (id: number, isCompleted: boolean) => Promise<void>;
}

const StepCard: React.FC<StepCardProps> = ({ step, onUpdate, onDelete, onToggleComplete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(step.content);
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setEditingContent(step.content);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditingContent(step.content);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editingContent.trim()) {
      message.error('内容不能为空');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(step.id, editingContent.trim());
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
      await onDelete(step.id);
      message.success('删除成功');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleToggleComplete = async (checked: boolean) => {
    try {
      await onToggleComplete(step.id, checked);
    } catch (error) {
      message.error('状态更新失败');
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
            rows={2}
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Checkbox
            checked={step.is_completed}
            onChange={(e) => handleToggleComplete(e.target.checked)}
            style={{ marginTop: '4px' }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                marginBottom: 8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.6',
                color: step.is_completed ? '#999' : '#333',
                textDecoration: step.is_completed ? 'line-through' : 'none',
              }}
            >
              {step.content}
            </div>
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
                title="确定删除这个步骤吗？"
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

export default StepCard;