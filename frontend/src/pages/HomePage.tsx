import React, { useEffect, useState } from 'react';
import { 
  Layout, List, Card, Button, Input, Select, Modal, Form, 
  DatePicker, message, Space, Tag, Popconfirm, Empty 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, FilterOutlined, 
  EditOutlined, DeleteOutlined, CheckCircleOutlined, 
  ClockCircleOutlined, FileTextOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { todoService } from '../services/todoService';
import { useTodoStore } from '../store/todoStore';
import { useAuthStore } from '../store/authStore';
import type { Todo } from '../types';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { TextArea } = Input;

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { filter, setFilter, setSelectedTodo } = useTodoStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [form] = Form.useForm();

  const { data: todosData, isLoading, refetch } = useQuery({
    queryKey: ['todos', filter],
    queryFn: () => todoService.getTodos(filter),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: todoService.createTodo,
    onSuccess: (response) => {
      if (response.success && response.data) {
        message.success('创建成功');
        setIsModalOpen(false);
        form.resetFields();
        refetch();
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: todoService.deleteTodo,
    onSuccess: () => {
      message.success('删除成功');
      refetch();
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: number; isCompleted: boolean }) =>
      todoService.toggleComplete(id, isCompleted),
    onSuccess: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleCreate = () => {
    setEditingTodo(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (todo: Todo) => {
    setEditingTodo(todo);
    form.setFieldsValue({
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      due_date: todo.due_date ? dayjs(todo.due_date) : null,
    });
    setIsModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        title: values.title,
        description: values.description,
        priority: values.priority,
        due_date: values.due_date ? values.due_date.toISOString() : undefined,
      };

      if (editingTodo) {
        await todoService.updateTodo(editingTodo.id, data);
        message.success('更新成功');
      } else {
        createMutation.mutate(data);
      }
      
      setIsModalOpen(false);
      form.resetFields();
      refetch();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleToggleComplete = (todo: Todo) => {
    toggleCompleteMutation.mutate({
      id: todo.id,
      isCompleted: !todo.is_completed,
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, color: '#667eea' }}>质日</h1>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleCreate}
            style={{ background: '#667eea', borderColor: '#667eea' }}
          >
            新建任务
          </Button>
          <Button onClick={() => useAuthStore.getState().clearAuth()}>
            退出登录
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card style={{ marginBottom: 24 }}>
          <Space style={{ width: '100%' }} size="middle">
            <Input
              placeholder="搜索任务..."
              prefix={<SearchOutlined />}
              value={filter.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              style={{ width: 300 }}
            />
            <Select
              placeholder="状态"
              value={filter.status || undefined}
              onChange={(value) => setFilter({ status: value || '' })}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
            </Select>
            <Select
              placeholder="优先级"
              value={filter.priority || undefined}
              onChange={(value) => setFilter({ priority: value || '' })}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Space>
        </Card>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>
        ) : todosData?.data?.todos && todosData.data.todos.length > 0 ? (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
            dataSource={todosData.data.todos}
            renderItem={(todo) => (
              <List.Item>
                <Card
                  hoverable
                  style={{
                    height: '100%',
                    opacity: todo.is_completed ? 0.6 : 1,
                  }}
                  actions={[
                    <Button
                      key="complete"
                      type="text"
                      icon={todo.is_completed ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                      onClick={() => handleToggleComplete(todo)}
                    >
                      {todo.is_completed ? '已完成' : '标记完成'}
                    </Button>,
                    <Button
                      key="edit"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(todo)}
                    >
                      编辑
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="确定删除这个任务吗？"
                      onConfirm={() => handleDelete(todo.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="text" icon={<DeleteOutlined />} danger>
                        删除
                      </Button>
                    </Popconfirm>,
                  ]}
                  onClick={() => {
                    setSelectedTodo(todo);
                    navigate(`/todo/${todo.id}`);
                  }}
                >
                  <Card.Meta
                    title={
                      <Space>
                        <span style={{ 
                          textDecoration: todo.is_completed ? 'line-through' : 'none' 
                        }}>
                          {todo.title}
                        </span>
                        <Tag color={getPriorityColor(todo.priority)}>
                          {getPriorityText(todo.priority)}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        {todo.description && (
                          <div style={{ marginBottom: 8 }}>
                            {todo.description.length > 100
                              ? `${todo.description.slice(0, 100)}...`
                              : todo.description}
                          </div>
                        )}
                        {todo.due_date && (
                          <div style={{ color: '#999', fontSize: '12px' }}>
                            截止日期: {dayjs(todo.due_date).format('YYYY-MM-DD')}
                          </div>
                        )}
                        {todo.attachments && todo.attachments.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Tag icon={<FileTextOutlined />}>
                              {todo.attachments.length} 个附件
                            </Tag>
                          </div>
                        )}
                      </div>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无任务" />
        )}
      </Content>

      <Modal
        title={editingTodo ? '编辑任务' : '新建任务'}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
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

          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="due_date" label="截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default HomePage;