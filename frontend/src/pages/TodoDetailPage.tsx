import React, { useEffect, useState } from 'react';
import { 
  Layout, Card, Button, Modal, Form, Input, DatePicker, 
  message, Space, Tag, List, Upload, Image, Popconfirm,
  Descriptions, Empty, Select 
} from 'antd';
import { 
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, 
  CheckCircleOutlined, UploadOutlined, FileOutlined,
  DownloadOutlined, EyeOutlined 
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { todoService } from '../services/todoService';
import { attachmentService } from '../services/attachmentService';
import { useTodoStore } from '../store/todoStore';
import type { Todo, Attachment } from '../types';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Header, Content } = Layout;

const TodoDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { selectedTodo, setSelectedTodo } = useTodoStore();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [form] = Form.useForm();

  const todoId = parseInt(id || '0');

  const { data: todoData, isLoading, refetch } = useQuery({
    queryKey: ['todo', todoId],
    queryFn: () => todoService.getTodo(todoId),
    enabled: !!todoId,
  });

  const todo = todoData?.data || selectedTodo;

  const updateMutation = useMutation({
    mutationFn: (data: any) => todoService.updateTodo(todoId, data),
    onSuccess: () => {
      message.success('更新成功');
      setIsEditModalOpen(false);
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => todoService.deleteTodo(todoId),
    onSuccess: () => {
      message.success('删除成功');
      navigate('/');
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (isCompleted: boolean) => 
      todoService.toggleComplete(todoId, isCompleted),
    onSuccess: () => {
      refetch();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentService.uploadAttachment(todoId, file),
    onSuccess: () => {
      message.success('上传成功');
      refetch();
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: number) => 
      attachmentService.deleteAttachment(attachmentId),
    onSuccess: () => {
      message.success('删除成功');
      refetch();
    },
  });

  useEffect(() => {
    if (todo) {
      setSelectedTodo(todo);
    }
  }, [todo, setSelectedTodo]);

  const handleEdit = () => {
    if (todo) {
      form.setFieldsValue({
        title: todo.title,
        description: todo.description,
        priority: todo.priority,
        due_date: todo.due_date ? dayjs(todo.due_date) : null,
      });
      setIsEditModalOpen(true);
    }
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        title: values.title,
        description: values.description,
        priority: values.priority,
        due_date: values.due_date ? values.due_date.toISOString() : undefined,
      };
      updateMutation.mutate(data);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleUpload = async (file: File) => {
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    
    if (file.size > MAX_FILE_SIZE) {
      Modal.error({
        title: '文件过大',
        content: `文件大小超过20MB限制，当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`,
        okText: '确定',
        width: 400,
        centered: true,
      });
      return false;
    }
    
    try {
      await uploadMutation.mutateAsync(file);
      message.success('上传成功');
    } catch (error) {
      console.error('上传失败:', error);
      Modal.error({
        title: '上传失败',
        content: '文件上传失败，请重试',
        okText: '确定',
        width: 400,
        centered: true,
      });
    }
    return false;
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const handleToggleComplete = () => {
    if (todo) {
      toggleCompleteMutation.mutate(!todo.is_completed);
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    if (attachment.file_type === 'image') {
      try {
        const response = await attachmentService.previewAttachment(attachment.id);
        const url = URL.createObjectURL(response.data);
        setPreviewImage(url);
        setIsPreviewOpen(true);
      } catch (error) {
        message.error('预览失败');
      }
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const response = await attachmentService.downloadAttachment(attachment.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.original_filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error('下载失败');
    }
  };

  const handleDeleteAttachment = (attachmentId: number) => {
    deleteAttachmentMutation.mutate(attachmentId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '无';
    }
  };

  const getFileIcon = (attachment: Attachment) => {
    if (attachment.file_type === 'image') {
      return <EyeOutlined />;
    }
    return <FileOutlined />;
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>;
  }

  if (!todo) {
    return <Empty description="任务不存在" />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        lineHeight: '64px'
      }}>
        <Space size="middle" style={{ alignItems: 'center' }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
            style={{ height: '36px' }}
          >
            返回
          </Button>
          <h1 style={{ 
            margin: 0, 
            color: '#667eea', 
            fontSize: '18px', 
            fontWeight: 600,
            lineHeight: '36px',
            display: 'inline-block'
          }}>
            任务详情
          </h1>
        </Space>
        <Space size="small" style={{ alignItems: 'center' }}>
          <Button
            type={todo.is_completed ? 'default' : 'primary'}
            icon={<CheckCircleOutlined />}
            onClick={handleToggleComplete}
            style={{ height: '36px' }}
          >
            {todo.is_completed ? '标记未完成' : '标记完成'}
          </Button>
          <Button 
            icon={<EditOutlined />} 
            onClick={handleEdit}
            style={{ height: '36px' }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个任务吗？"
            onConfirm={handleDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              icon={<DeleteOutlined />} 
              danger
              style={{ height: '36px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card style={{ marginBottom: 24 }}>
          <Descriptions title={todo.title} bordered column={2}>
            <Descriptions.Item label="状态">
              <Tag color={todo.is_completed ? 'green' : 'blue'}>
                {todo.is_completed ? '已完成' : '进行中'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={getPriorityColor(todo.priority)}>
                {getPriorityText(todo.priority)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="截止日期" span={2}>
              {todo.due_date ? dayjs(todo.due_date).format('YYYY-MM-DD HH:mm') : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {todo.description || '无'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {dayjs(todo.created_at).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card 
          title="附件" 
          extra={
            <Upload
              showUploadList={false}
              beforeUpload={handleUpload}
            >
              <Button icon={<UploadOutlined />} loading={uploadMutation.isPending}>
                上传附件
              </Button>
            </Upload>
          }
        >
          {todo.attachments && todo.attachments.length > 0 ? (
            <List
              dataSource={todo.attachments}
              renderItem={(attachment) => (
                <List.Item
                  actions={[
                    attachment.file_type === 'image' && (
                      <Button
                        key="preview"
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={() => handlePreview(attachment)}
                      >
                        预览
                      </Button>
                    ),
                    <Button
                      key="download"
                      type="text"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(attachment)}
                    >
                      下载
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="确定删除这个附件吗？"
                      onConfirm={() => handleDeleteAttachment(attachment.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="text" icon={<DeleteOutlined />} danger>
                        删除
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={getFileIcon(attachment)}
                    title={attachment.original_filename}
                    description={
                      <Space>
                        <Tag>{attachment.file_type}</Tag>
                        <span>
                          {attachment.file_size 
                            ? `${(attachment.file_size / 1024).toFixed(2)} KB`
                            : '未知大小'}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无附件" />
          )}
        </Card>
      </Content>

      <Modal
        title="编辑任务"
        open={isEditModalOpen}
        onOk={handleUpdate}
        onCancel={() => setIsEditModalOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="任务标题" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={4} placeholder="任务描述" />
          </Form.Item>

          <Form.Item name="priority" label="优先级">
            <Select>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="due_date" label="截止日期">
            <DatePicker style={{ width: '100%' }} showTime />
          </Form.Item>
        </Form>
      </Modal>

      <Image
        style={{ display: 'none' }}
        preview={{
          visible: isPreviewOpen,
          src: previewImage,
          onVisibleChange: (visible) => {
            setIsPreviewOpen(visible);
            if (!visible) {
              URL.revokeObjectURL(previewImage);
            }
          },
        }}
      />
    </Layout>
  );
};

export default TodoDetailPage;